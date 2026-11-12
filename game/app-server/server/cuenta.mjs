// Cuentas (S08, 09/11; pedido de Juan "invitados, progreso en el servidor y cuentas", puntos 3-5). Primero Google.
// - Web: el botón de Google (Google Identity Services) da un "credential" (JWT firmado por Google); el servidor lo
//   verifica con las claves públicas de Google (sin librerías) y se queda solo con el id de la cuenta (sub) y el mail.
// - App de escritorio: Google no deja entrar desde app://, así que la app abre el navegador en /cuenta?s=<sesión>,
//   el jugador entra ahí y la app pregunta cada 2 s hasta que la sesión tiene la cuenta.
// - Unir con el invitado: si la cuenta es nueva, el invitado pasa a ser la cuenta. Si la cuenta YA tenía otro jugador
//   y este dispositivo tiene progreso propio, se PREGUNTA cuál conservar ('cuenta' o 'dispositivo'); no se mezclan.
// Se activa con el secreto GOOGLE_CLIENT_ID (sin él, el botón no aparece). API en docs/sesiones/S08 ("Cuentas").
import crypto from 'node:crypto';
import * as DB from './db.mjs';

const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || '';
const CERTS_URL = () => process.env.GOOGLE_CERTS_URL || 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_MS = 10 * 60e3;

let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    acc: db.prepare('SELECT * FROM accounts WHERE provider = ? AND subject = ?'),
    accOf: db.prepare('SELECT * FROM accounts WHERE player = ?'),
    accIns: db.prepare('INSERT INTO accounts (provider, subject, player, email, created) VALUES (?, ?, ?, ?, ?)'),
    accMove: db.prepare('UPDATE accounts SET player = ?, email = ? WHERE provider = ? AND subject = ?'),
    accDelPlayer: db.prepare('DELETE FROM accounts WHERE player = ? AND provider = ?'),
    player: db.prepare('SELECT id, pub, name, games, wins, rating FROM players WHERE id = ?'),
    saves: db.prepare('SELECT section, data FROM saves WHERE player = ?'),
    tokIns: db.prepare('INSERT INTO tokens (token_hash, player, created) VALUES (?, ?, ?)'),
  });
};

// ---- verificar el token de Google ----
let CERTS = { at: 0, keys: [] };
async function certs() {
  if (Date.now() - CERTS.at < 3600e3 && CERTS.keys.length) return CERTS.keys;
  const r = await fetch(CERTS_URL(), { signal: AbortSignal.timeout(5000) }); const j = await r.json();
  CERTS = { at: Date.now(), keys: j.keys || [] }; return CERTS.keys;
}
const b64 = (s) => Buffer.from(s, 'base64url');
export async function verifyGoogle(credential) {
  if (!CLIENT_ID()) return { error: 'apagado' };
  try {
    const [h, p, sig] = String(credential || '').split('.'); if (!sig) return { error: 'token' };
    const head = JSON.parse(b64(h)), pay = JSON.parse(b64(p));
    if (head.alg !== 'RS256') return { error: 'token' };
    let jwk = (await certs()).find((k) => k.kid === head.kid);
    if (!jwk) { CERTS.at = 0; jwk = (await certs()).find((k) => k.kid === head.kid); } // Google rota las claves
    if (!jwk) return { error: 'token' };
    const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64(sig));
    if (!ok) return { error: 'token' };
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(pay.iss) || pay.aud !== CLIENT_ID() || !(pay.exp * 1000 > Date.now() - 60e3) || !pay.sub) return { error: 'token' };
    return { ok: true, sub: String(pay.sub), email: pay.email ? String(pay.email).slice(0, 120) : null };
  } catch { return { error: 'token' }; }
}

// ---- resumen de progreso (para preguntar cuál conservar) ----
function resumen(id) {
  const p = st().player.get(id); if (!p) return null;
  let mazos = 0, campana = false;
  for (const r of st().saves.all(id)) {
    try { const d = JSON.parse(r.data); if (r.section === 'mazos') for (const v of Object.values(JSON.parse(d['asedio-decks'] || '{}') || {})) mazos += Array.isArray(v) ? v.length : 0; if (r.section === 'campana') campana = !!d['asedio-camp']; } catch {}
  }
  return { name: p.name, games: p.games, wins: p.wins, rating: p.rating, mazos, campana };
}
const hasProgress = (r) => !!r && (r.games > 0 || r.mazos > 0 || r.campana);
const newToken = (player) => { const t = crypto.randomBytes(36).toString('base64url'); st().tokIns.run(DB.hashToken(t), player, Date.now()); return t; };
export const maskEmail = (e) => (e ? e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(6, Math.max(2, b.length))) + c) : null);

// Unir la cuenta verificada {sub, email} con el jugador de este dispositivo. elegir: 'cuenta' | 'dispositivo' (si se preguntó)
export function unir({ sub, email }, { pid, ptoken, elegir }, provider = 'google') {
  if (!st()) return { error: 'sin base' };
  const me = DB.auth(pid, ptoken, null); if (!me) return { error: 'identidad' };
  const acc = st().acc.get(provider, sub);
  const yaTengo = st().accOf.all(me.id).find((a) => a.provider === provider);
  if (!acc) {                                                   // cuenta nueva: el invitado pasa a ser la cuenta
    if (yaTengo) return { error: 'otra cuenta' };               // este jugador ya está unido a OTRA cuenta de Google
    st().accIns.run(provider, sub, me.id, email, Date.now());
    return { ok: true, resultado: 'nueva', pid: me.id, email: maskEmail(email) };
  }
  if (acc.player === me.id) return { ok: true, resultado: 'misma', pid: me.id, email: maskEmail(email) };
  const cuenta = resumen(acc.player), disp = resumen(me.id);
  if (!cuenta) { st().accMove.run(me.id, email, provider, sub); return { ok: true, resultado: 'nueva', pid: me.id, email: maskEmail(email) }; } // la cuenta apuntaba a un jugador borrado
  if (!elegir && hasProgress(disp) && !yaTengo) return { ok: true, pregunta: true, cuenta, dispositivo: disp };
  if (elegir === 'dispositivo' && !yaTengo) {                   // la cuenta pasa a este jugador; el de antes queda sin cuenta (no se mezclan)
    st().accMove.run(me.id, email, provider, sub);
    return { ok: true, resultado: 'dispositivo', pid: me.id, email: maskEmail(email) };
  }
  // 'cuenta' (o este dispositivo no tenía nada): este dispositivo pasa a ser el jugador de la cuenta, con una llave nueva
  return { ok: true, resultado: 'cuenta', pid: acc.player, ptoken: newToken(acc.player), name: cuenta.name, email: maskEmail(email) };
}

// ---- sesiones para entrar desde el navegador (app de escritorio) ----
const SES = new Map(); // id -> { pid, expires, sub?, email? }
setInterval(() => { const t = Date.now(); for (const [k, v] of SES) if (v.expires < t) SES.delete(k); }, 60e3).unref();
export function sesionIniciar({ pid, ptoken }) {
  if (!st()) return { error: 'sin base' }; if (!CLIENT_ID()) return { error: 'apagado' };
  const me = DB.auth(pid, ptoken, null); if (!me) return { error: 'identidad' };
  const s = crypto.randomBytes(18).toString('base64url'); SES.set(s, { pid: me.id, expires: Date.now() + SESSION_MS });
  return { ok: true, s, expires: Date.now() + SESSION_MS };
}
export async function sesionGoogle({ s, credential }) {
  const x = SES.get(String(s || '')); if (!x || x.expires < Date.now()) return { error: 'sesión' };
  const v = await verifyGoogle(credential); if (!v.ok) return v;
  x.sub = v.sub; x.email = v.email; return { ok: true };
}
export function sesionEstado({ s, pid, ptoken, elegir }) {
  const x = SES.get(String(s || '')); if (!x || x.expires < Date.now()) return { error: 'sesión' };
  const me = DB.auth(pid, ptoken, null); if (!me || me.id !== x.pid) return { error: 'identidad' };
  if (!x.sub) return { ok: true, esperando: true };
  const r = unir({ sub: x.sub, email: x.email }, { pid, ptoken, elegir });
  if (r.ok && !r.pregunta) SES.delete(s); // un solo uso
  return r;
}

// Estado de la cuenta de este jugador (para el perfil)
export function estado({ pid, ptoken }) {
  if (!st()) return { ok: true, google: null, activo: false };
  const me = DB.auth(pid, ptoken, null); if (!me) return { error: 'identidad' };
  const g = st().accOf.all(me.id).find((a) => a.provider === 'google');
  return { ok: true, activo: !!CLIENT_ID(), google: g ? maskEmail(g.email) || 'conectada' : null };
}
// Desconectar Google de este jugador (el progreso queda en el invitado)
export function desconectar({ pid, ptoken }) {
  if (!st()) return { error: 'sin base' };
  const me = DB.auth(pid, ptoken, null); if (!me) return { error: 'identidad' };
  st().accDelPlayer.run(me.id, 'google'); return { ok: true };
}
// "Borrar mi cuenta": se borra todo del servidor
export function borrar({ pid, ptoken, confirmo }) {
  if (!st()) return { error: 'sin base' };
  if (confirmo !== 'DELETE_ACCOUNT' && confirmo !== 'BORRAR') return { error: 'confirmación' }; // código fijo (la palabra que escribe el jugador la revisa el cliente en su idioma); BORRAR = clientes viejos
  const me = DB.auth(pid, ptoken, null); if (!me) return { error: 'identidad' };
  DB.deletePlayer(me.id); return { ok: true };
}
export const config = () => ({ google: CLIENT_ID() || null });
