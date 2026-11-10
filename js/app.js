import * as db from './db.js';
import * as huella from './huella.js';
import {
  toKey, fromKey, todayKey, addDays, weekday, nowTime,
  monthLabel, weekdayLabel, longLabel, shortLabel, clockLabel, timeLabel,
} from './dates.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  tasks: [],
  records: new Map(), // id `${taskId}|${date}` -> record
  credId: null,
  selected: todayKey(),
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  editingId: null,
};

const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const recordId = (taskId, date) => `${taskId}|${date}`;

// ---------- Reglas de las tareas ----------

function occursOn(task, date) {
  if (date < task.startDate) return false;
  if (task.endDate && date > task.endDate) return false;
  if (task.repeat === 'once') return date === task.startDate;
  return task.days.includes(weekday(date));
}

function tasksFor(date) {
  return state.tasks
    .filter((t) => occursOn(t, date))
    .sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

function statusOf(task, date) {
  if (state.records.has(recordId(task.id, date))) return 'done';
  const today = todayKey();
  if (date > today) return 'future';
  if (date < today) return 'missed';
  return task.time < nowTime() ? 'late' : 'pending';
}

function daySummary(date) {
  const list = tasksFor(date);
  const done = list.filter((t) => state.records.has(recordId(t.id, date))).length;
  let kind = 'pending';
  if (list.length && done === list.length) kind = 'done';
  else if (date < todayKey()) kind = 'missed';
  return { total: list.length, done, kind };
}

// ---------- Calendario ----------

function renderCalendar() {
  $('#monthTitle').textContent = monthLabel(state.year, state.month);
  const grid = $('#grid');
  grid.replaceChildren();

  const first = new Date(state.year, state.month, 1);
  const start = toKey(new Date(state.year, state.month, 1 - first.getDay()));
  const today = todayKey();

  for (let i = 0; i < 42; i++) {
    const key = addDays(start, i);
    const d = fromKey(key);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (d.getMonth() !== state.month) cell.classList.add('other');
    if (key === today) cell.classList.add('today');
    if (key === state.selected) cell.classList.add('selected');

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = d.getDate();
    cell.append(num);

    const s = daySummary(key);
    let label = longLabel(key);
    if (s.total) {
      const count = document.createElement('span');
      count.className = `count ${s.kind}`;
      count.textContent = `${s.done}/${s.total}`;
      cell.append(count);
      label += `, ${s.done} de ${s.total} tareas hechas`;
    }
    cell.setAttribute('aria-label', label);
    cell.addEventListener('click', () => openDay(key));
    grid.append(cell);
  }
}

// ---------- Vista del día ----------

const ICON_FINGER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function metaText(task, date, status) {
  const rec = state.records.get(recordId(task.id, date));
  const repeat = task.repeat === 'weekly' ? ' · se repite' : '';
  switch (status) {
    case 'done': {
      const doneDay = toKey(new Date(rec.doneAt));
      const when = doneDay === date ? clockLabel(rec.doneAt) : `${shortLabel(doneDay)}, ${clockLabel(rec.doneAt)}`;
      return `Hecho a las ${when}${rec.method === 'huella' ? ' · con huella' : ''}`;
    }
    case 'missed': return `No se registró${repeat}`;
    case 'late': return `Atrasada${repeat}`;
    case 'future': return `Programada${repeat}`;
    default: return `Pendiente${repeat}`;
  }
}

function renderDay() {
  const date = state.selected;
  const today = todayKey();
  $('#dayWeekday').textContent = date === today ? `Hoy · ${weekdayLabel(date)}` : weekdayLabel(date);
  $('#dayTitle').textContent = longLabel(date);

  const list = tasksFor(date);
  const s = daySummary(date);
  $('#progressBar').style.width = s.total ? `${(s.done / s.total) * 100}%` : '0';
  $('#daySummary').textContent = s.total
    ? (s.done === s.total ? `¡Listo! Hiciste las ${s.total} tareas. 🌿` : `${s.done} de ${s.total} hechas`)
    : '';

  const ul = $('#taskList');
  ul.replaceChildren();
  $('#emptyState').hidden = list.length > 0;

  for (const task of list) {
    const status = statusOf(task, date);
    const li = document.createElement('li');
    li.className = `task ${status === 'late' ? 'missed' : status}`;

    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = timeLabel(task.time);

    const info = document.createElement('div');
    info.className = 'info';
    info.title = 'Editar tarea';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = task.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = metaText(task, date, status);
    info.append(name, meta);
    info.addEventListener('click', () => openTaskDialog(task));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'check';
    if (status === 'done') {
      btn.innerHTML = ICON_CHECK;
      btn.setAttribute('aria-label', `Desmarcar ${task.name}`);
      btn.addEventListener('click', () => unmark(task, date));
    } else {
      btn.innerHTML = ICON_FINGER;
      btn.setAttribute('aria-label', `Registrar ${task.name} con huella`);
      btn.disabled = status === 'future';
      if (btn.disabled) btn.title = 'Todavía no es ese día';
      btn.addEventListener('click', () => mark(task, date));
    }

    li.append(time, info, btn);
    ul.append(li);
  }
}

function render() {
  renderCalendar();
  renderDay();
}

function openDay(key) {
  state.selected = key;
  const d = fromKey(key);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  render();
  if (!isDesktop() && !document.body.classList.contains('show-day')) {
    document.body.classList.add('show-day');
    history.pushState({ day: key }, '');
    window.scrollTo(0, 0);
  }
}

function closeDay() {
  if (history.state?.day) history.back();
  else document.body.classList.remove('show-day');
}

window.addEventListener('popstate', () => document.body.classList.remove('show-day'));

// ---------- Huella: marcar y desmarcar ----------

async function confirmIdentity() {
  if (state.credId) {
    await huella.verificar(state.credId);
    return 'huella';
  }
  if (await huella.disponible()) {
    const id = await huella.registrar();
    state.credId = id;
    await db.setSetting('credId', id);
    toast('Huella configurada ✨');
    return 'huella';
  }
  const ok = confirm('Este dispositivo o navegador no permite usar la huella aquí.\n¿Registrar sin huella?');
  if (!ok) throw new DOMException('cancelado', 'AbortError');
  return 'manual';
}

function explainError(err) {
  if (err?.name === 'AbortError') return null;
  if (err?.name === 'NotAllowedError') return 'No se verificó la huella. Inténtalo otra vez.';
  if (err?.name === 'InvalidStateError') return 'Esa huella ya estaba registrada. Revisa Ajustes.';
  return 'Algo salió mal con la huella. Puedes reconfigurarla en Ajustes.';
}

let busy = false;

async function mark(task, date) {
  if (busy) return;
  busy = true;
  try {
    const method = await confirmIdentity();
    const rec = { id: recordId(task.id, date), taskId: task.id, date, doneAt: new Date().toISOString(), method };
    await db.put('records', rec);
    state.records.set(rec.id, rec);
    navigator.vibrate?.(40);
    render();
    const s = daySummary(date);
    toast(s.done === s.total ? '¡Todo listo por hoy! 🎉' : `"${task.name}" registrada ✓`);
  } catch (err) {
    const msg = explainError(err);
    if (msg) toast(msg);
  } finally {
    busy = false;
  }
}

async function unmark(task, date) {
  if (busy) return;
  if (!confirm(`¿Desmarcar "${task.name}"?\nSe borrará el registro de este día.`)) return;
  busy = true;
  try {
    await confirmIdentity();
    const id = recordId(task.id, date);
    await db.remove('records', id);
    state.records.delete(id);
    render();
    toast('Registro borrado');
  } catch (err) {
    const msg = explainError(err);
    if (msg) toast(msg);
  } finally {
    busy = false;
  }
}

// ---------- Crear / editar tareas ----------

const taskDialog = $('#taskDialog');
const form = $('#taskForm');
const dayBoxes = () => [...document.querySelectorAll('#fDays input')];

function setRepeat(value) {
  form.elements.repeat.value = value;
  $('#repeatBox').hidden = value !== 'weekly';
}

function openTaskDialog(task = null) {
  state.editingId = task?.id ?? null;
  $('#taskDialogTitle').textContent = task ? 'Editar tarea' : 'Nueva tarea';
  $('#btnDelete').hidden = !task;
  $('#formError').hidden = true;

  $('#fName').value = task?.name ?? '';
  $('#fTime').value = task?.time ?? defaultTime();
  $('#fStart').value = task?.startDate ?? state.selected;
  $('#fEnd').value = task?.endDate ?? '';
  const days = task?.days ?? [weekday(state.selected)];
  dayBoxes().forEach((b) => { b.checked = days.includes(Number(b.value)); });
  setRepeat(task?.repeat ?? 'once');

  taskDialog.showModal();
  if (!task) $('#fName').focus();
}

function defaultTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

form.addEventListener('change', (e) => {
  if (e.target.name === 'repeat') setRepeat(e.target.value);
});

document.querySelectorAll('.quick [data-days]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const days = btn.dataset.days.split(',').map(Number);
    dayBoxes().forEach((b) => { b.checked = days.includes(Number(b.value)); });
  });
});

function formError(msg) {
  const el = $('#formError');
  el.textContent = msg;
  el.hidden = false;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#fName').value.trim();
  const repeat = form.elements.repeat.value;
  const days = dayBoxes().filter((b) => b.checked).map((b) => Number(b.value)).sort();
  const startDate = $('#fStart').value;
  const endDate = repeat === 'weekly' && $('#fEnd').value ? $('#fEnd').value : null;

  if (!name) return formError('Escribe el nombre de la tarea.');
  if (repeat === 'weekly' && !days.length) return formError('Elige al menos un día.');
  if (endDate && endDate < startDate) return formError('La fecha "hasta" debe ser después de "desde".');

  const prev = state.tasks.find((t) => t.id === state.editingId);
  const task = {
    id: prev?.id ?? uid(),
    name,
    time: $('#fTime').value,
    repeat,
    days: repeat === 'weekly' ? days : [weekday(startDate)],
    startDate,
    endDate,
    createdAt: prev?.createdAt ?? new Date().toISOString(),
  };

  await db.put('tasks', task);
  state.tasks = prev ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task];
  taskDialog.close();
  render();
  toast(prev ? 'Tarea actualizada' : 'Tarea agregada');
});

$('#btnDelete').addEventListener('click', async () => {
  const task = state.tasks.find((t) => t.id === state.editingId);
  if (!task) return;
  const today = todayKey();
  const hasPast = task.startDate < today;

  const msg = hasPast
    ? `¿Eliminar "${task.name}" de hoy en adelante?\nTu historial de días anteriores se conserva.`
    : `¿Eliminar "${task.name}"?`;
  if (!confirm(msg)) return;

  if (hasPast) {
    // Se "cierra" la tarea ayer para conservar el historial.
    const closed = { ...task, endDate: addDays(today, -1) };
    await db.put('tasks', closed);
    state.tasks = state.tasks.map((t) => (t.id === task.id ? closed : t));
    for (const [id, rec] of state.records) {
      if (rec.taskId === task.id && rec.date >= today) {
        await db.remove('records', id);
        state.records.delete(id);
      }
    }
  } else {
    await db.remove('tasks', task.id);
    state.tasks = state.tasks.filter((t) => t.id !== task.id);
    for (const [id, rec] of state.records) {
      if (rec.taskId === task.id) {
        await db.remove('records', id);
        state.records.delete(id);
      }
    }
  }
  taskDialog.close();
  render();
  toast('Tarea eliminada');
});

// ---------- Ajustes ----------

const settingsDialog = $('#settingsDialog');

async function renderSettings() {
  const available = await huella.disponible();
  const status = $('#huellaStatus');
  const btn = $('#btnSetupHuella');
  if (!huella.soportada()) {
    status.textContent = 'La huella necesita abrir la app desde una dirección segura (https). Mientras tanto, las tareas se registran con una confirmación.';
    btn.hidden = true;
  } else if (!available) {
    status.textContent = 'Este dispositivo no tiene lector de huella (o desbloqueo con rostro/PIN) disponible para el navegador.';
    btn.hidden = true;
  } else {
    btn.hidden = false;
    status.textContent = state.credId
      ? 'Tu huella está configurada. Se pedirá cada vez que registres una tarea.'
      : 'Aún no configuras tu huella. Se configura sola la primera vez que registres una tarea, o hazlo ahora.';
    btn.textContent = state.credId ? 'Volver a configurar' : 'Configurar huella';
  }
}

$('#btnSettings').addEventListener('click', async () => {
  await renderSettings();
  settingsDialog.showModal();
});

$('#btnSetupHuella').addEventListener('click', async () => {
  try {
    const id = await huella.registrar();
    state.credId = id;
    await db.setSetting('credId', id);
    toast('Huella configurada ✨');
    renderSettings();
  } catch (err) {
    const msg = explainError(err);
    if (msg) toast(msg);
  }
});

$('#btnExport').addEventListener('click', () => {
  const data = {
    app: 'checador',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    records: [...state.records.values()],
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `checador-respaldo-${todayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#fileImport').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'checador' || !Array.isArray(data.tasks) || !Array.isArray(data.records)) {
      throw new Error('formato');
    }
    if (!confirm(`Restaurar ${data.tasks.length} tareas y ${data.records.length} registros?\nEsto reemplaza lo que hay ahora.`)) return;
    await db.replaceAll(data);
    await load();
    render();
    toast('Respaldo restaurado');
  } catch {
    toast('Ese archivo no parece un respaldo del Checador');
  }
});

// ---------- Utilidades de interfaz ----------

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

document.querySelectorAll('dialog [data-close]').forEach((b) => {
  b.addEventListener('click', () => b.closest('dialog').close());
});
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // tocar fuera cierra
});

$('#prevMonth').addEventListener('click', () => shiftMonth(-1));
$('#nextMonth').addEventListener('click', () => shiftMonth(1));
$('#btnToday').addEventListener('click', () => openDay(todayKey()));
$('#btnBack').addEventListener('click', closeDay);
$('#btnAdd').addEventListener('click', () => openTaskDialog());

function shiftMonth(n) {
  const d = new Date(state.year, state.month + n, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  renderCalendar();
}

function updateOnline() {
  $('#offlineBadge').hidden = navigator.onLine;
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

// Refresca cada minuto (tareas "atrasadas", cambio de día a medianoche).
let lastToday = todayKey();
setInterval(() => {
  const t = todayKey();
  if (t !== lastToday && state.selected === lastToday) state.selected = t;
  lastToday = t;
  render();
}, 60_000);

// ---------- Inicio ----------

async function load() {
  const [tasks, records, credId] = await Promise.all([
    db.getAll('tasks'), db.getAll('records'), db.getSetting('credId'),
  ]);
  state.tasks = tasks;
  state.records = new Map(records.map((r) => [r.id, r]));
  state.credId = credId ?? null;
}

async function init() {
  await load();
  updateOnline();
  render();
  db.askPersistence();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
