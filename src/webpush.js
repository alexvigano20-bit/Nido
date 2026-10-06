// Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) using only WebCrypto.
// Works in Deno (Supabase Edge Functions) and Node 20+.
const te = new TextEncoder();
export const b64u = {
  enc: u8 => btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0)),
};
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
export async function encrypt(payload, sub, test = {}) {
  const uaPub = b64u.dec(sub.keys.p256dh), auth = b64u.dec(sub.keys.auth);
  let asPriv, asPub;
  if (test.asPrivJwk) {
    asPriv = await crypto.subtle.importKey('jwk', test.asPrivJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    asPub = test.asPub;
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPriv = kp.privateKey; asPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPriv, 256));
  const ikm = await hkdf(auth, shared, cat(te.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = test.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(typeof payload === 'string' ? te.encode(payload) : payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
export async function vapidHeader(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const head = b64u.enc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.enc(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject })));
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: vapid.x, y: vapid.y, d: vapid.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + body)));
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${vapid.publicKey}`;
}
export async function sendPush(sub, payload, vapid, ttl = 86400) {
  const body = await encrypt(JSON.stringify(payload), sub);
  return fetch(sub.endpoint, { method: 'POST', body, headers: {
    Authorization: await vapidHeader(sub.endpoint, vapid), 'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'high' } });
}
