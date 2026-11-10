// Almacenamiento local con IndexedDB. Todo vive en el dispositivo.
//   tasks:    { id, name, time, repeat: 'once'|'weekly', days: [0-6], startDate, endDate, createdAt }
//   records:  { id: `${taskId}|${date}`, taskId, date, doneAt, method: 'huella'|'manual' }
//   settings: { key, value }

const DB_NAME = 'checador';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('records', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeNames, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    const stores = [].concat(storeNames).map((n) => tx.objectStore(n));
    const req = work(...stores);
    if (req) req.onsuccess = () => { result = req.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll());
export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value));
export const remove = (store, key) => run(store, 'readwrite', (s) => s.delete(key));

export async function getSetting(key) {
  const row = await run('settings', 'readonly', (s) => s.get(key));
  return row ? row.value : undefined;
}
export const setSetting = (key, value) => put('settings', { key, value });

export function replaceAll({ tasks = [], records = [] }) {
  return run(['tasks', 'records'], 'readwrite', (t, r) => {
    t.clear(); r.clear();
    tasks.forEach((x) => t.put(x));
    records.forEach((x) => r.put(x));
  });
}

// Pide al navegador que no borre los datos cuando falte espacio.
export async function askPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* no pasa nada */ }
}
