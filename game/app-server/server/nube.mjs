// Progreso en la nube y vinculación de dispositivos (S08, 09/11; pedido de Juan "invitados, progreso en el servidor").
// - Guardado por jugador (el mismo pid de invitado de siempre), en 4 partes independientes: mazos, campaña, perfil y
//   ajustes. Cada parte guarda las claves de localStorage del cliente tal cual (texto). Gana la última que se sube.
// - Código de vinculación: 6 letras/números (sin O/0/I/1), dura 10 min, un solo uso. El otro dispositivo recibe una
//   llave NUEVA del mismo jugador (tabla tokens); la llave del primero sigue andando.
// API documentada en docs/sesiones/S08-online-y-multijugador.md ("Progreso en la nube").
import crypto from 'node:crypto';
import * as DB from './db.mjs';
import { cleanName } from './abuso.mjs';

export const SECTIONS = ['mazos', 'campana', 'perfil', 'ajustes'];
export const MAX_SECTION = 256 * 1024, MAX_TOTAL = 512 * 1024;   // bytes por parte y por jugador
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 6;
const CODE_MS = Number(process.env.NUBE_CODE_MS) || 10 * 60e3;   // vida del código (10 min)
const FAILS_MAX = 10, FAILS_WINDOW = 10 * 60e3;                  // intentos fallidos de código por IP cada 10 min

let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    all: db.prepare('SELECT section, data, v, updated FROM saves WHERE player = ?'),
    one: db.prepare('SELECT v, length(data) AS n FROM saves WHERE player = ? AND section = ?'),
    size: db.prepare('SELECT COALESCE(SUM(length(data)), 0) AS n FROM saves WHERE player = ?'),
    put: db.prepare(`INSERT INTO saves (player, section, data, v, updated) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(player, section) DO UPDATE SET data = excluded.data, v = v + 1, updated = excluded.updated`),
    codeDel: db.prepare('DELETE FROM link_codes WHERE player = ?'),
    codeIns: db.prepare('INSERT INTO link_codes (code, player, expires) VALUES (?, ?, ?)'),
    codeGet: db.prepare('SELECT * FROM link_codes WHERE code = ?'),
    codeUse: db.prepare('DELETE FROM link_codes WHERE code = ?'),
    tokIns: db.prepare('INSERT INTO tokens (token_hash, player, created) VALUES (?, ?, ?)'),
    player: db.prepare('SELECT id, pub, name, games FROM players WHERE id = ?'),
  });
};
// el nombre solo se actualiza si el dispositivo tiene uno guardado (no pisar el del online con 'Jugador')
const who = ({ pid, ptoken, name }) => DB.auth(pid, ptoken, name ? cleanName(name) : null);

// Bajar todo lo guardado: { now, sections: { mazos: { v, updated, data: { clave: texto } }, ... } }
export function bajar(body) {
  if (!st()) return { error: 'sin base' };
  const p = who(body); if (!p) return { error: 'identidad' };
  const sections = {};
  for (const r of st().all.all(p.id)) { try { sections[r.section] = { v: r.v, updated: r.updated, data: JSON.parse(r.data) }; } catch {} }
  return { ok: true, now: Date.now(), pub: p.pub, sections };
}

// Subir partes: { sections: { mazos: { data: { clave: texto|null } } } } → { now, sections: { mazos: { v, updated } } }
export function subir(body) {
  if (!st()) return { error: 'sin base' };
  const p = who(body); if (!p) return { error: 'identidad' };
  const inS = body.sections && typeof body.sections === 'object' ? body.sections : {};
  const t = Date.now(), out = {};
  let total = st().size.get(p.id).n;
  for (const [sec, val] of Object.entries(inS)) {
    if (!SECTIONS.includes(sec) || !val || typeof val.data !== 'object' || Array.isArray(val.data)) return { error: 'parte' };
    const data = {};
    for (const [k, v] of Object.entries(val.data)) { if (typeof k !== 'string' || k.length > 64 || (v !== null && typeof v !== 'string')) return { error: 'parte' }; if (v !== null) data[k] = v; }
    const txt = JSON.stringify(data), prev = st().one.get(p.id, sec)?.n || 0;
    if (txt.length > MAX_SECTION) return { error: 'muy grande', section: sec };
    total += txt.length - prev; if (total > MAX_TOTAL) return { error: 'muy grande', section: sec };
    st().put.run(p.id, sec, txt, t);
    out[sec] = { v: st().one.get(p.id, sec).v, updated: t };
  }
  return { ok: true, now: t, sections: out };
}

// Pedir un código para vincular otro dispositivo (borra el anterior que tuviera)
export function crearCodigo(body) {
  if (!st()) return { error: 'sin base' };
  const p = who(body); if (!p) return { error: 'identidad' };
  st().codeDel.run(p.id);
  let code = ''; for (let i = 0; i < 20; i++) { code = Array.from(crypto.randomBytes(CODE_LEN), (b) => CODE_ABC[b % CODE_ABC.length]).join(''); if (!st().codeGet.get(code)) break; }
  const expires = Date.now() + CODE_MS; st().codeIns.run(code, p.id, expires);
  return { ok: true, code, expires, now: Date.now() };
}

// Usar un código (en el dispositivo nuevo): devuelve la identidad del jugador con una llave nueva para este dispositivo
const fails = new Map();
setInterval(() => { const t = Date.now(); for (const [ip, l] of fails) if (!l.some((x) => t - x < FAILS_WINDOW)) fails.delete(ip); }, 10 * 60e3).unref();
export function vincular({ code }, ip = '?') {
  if (!st()) return { error: 'sin base' };
  const t = Date.now(), list = (fails.get(ip) || []).filter((x) => t - x < FAILS_WINDOW);
  if (list.length >= FAILS_MAX) return { error: 'demasiados' };
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = c.length === CODE_LEN ? st().codeGet.get(c) : null;
  if (!r || r.expires < t) { list.push(t); fails.set(ip, list); if (r) st().codeUse.run(c); return { error: r ? 'vencido' : 'código' }; }
  st().codeUse.run(c); // un solo uso
  const p = st().player.get(r.player); if (!p) return { error: 'código' };
  const ptoken = crypto.randomBytes(36).toString('base64url');
  st().tokIns.run(DB.hashToken(ptoken), p.id, t);
  return { ok: true, pid: p.id, ptoken, pub: p.pub, name: p.name, games: p.games };
}
