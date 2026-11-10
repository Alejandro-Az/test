// Huella digital con WebAuthn (el mismo sistema de las "llaves de acceso").
// El navegador le pide al sistema operativo verificarte con huella, rostro o PIN.
// No hay servidor: esto confirma que *tú* estás frente al teléfono, como un sello
// personal. No es seguridad bancaria, y está bien para lo que queremos.

const random = (n) => crypto.getRandomValues(new Uint8Array(n));

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function soportada() {
  return Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials);
}

export async function disponible() {
  if (!soportada()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Crea la credencial. Al hacerlo el teléfono ya pide la huella.
export async function registrar() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Checador' },
      user: { id: random(16), name: 'checador', displayName: 'Checador de tareas' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'discouraged',
      },
      attestation: 'none',
      timeout: 60000,
    },
  });
  return toB64(cred.rawId);
}

// Pide la huella. Si el usuario cancela o falla, lanza un error.
export async function verificar(credId) {
  await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: fromB64(credId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return true;
}
