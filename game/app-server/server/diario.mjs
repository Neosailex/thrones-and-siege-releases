// Desafío diario de campaña (S08, 25/10). Lo usa la campaña (S10) desde el cliente; API documentada en
// docs/sesiones/S08-online-y-multijugador.md ("Desafío diario").
// - Un día = fecha UTC 'AAAA-MM-DD'. Semilla, reino y regla del día salen de la fecha: iguales para todos.
// - Un intento por jugador por día: 'empezar' lo registra (si recargás, devuelve el mismo intento); 'resultado' lo cierra.
// - Validación básica del resultado (no es anti-trampa completo: el juego corre en el cliente).
import crypto from 'node:crypto';
import * as DB from './db.mjs';
import { cleanName } from './abuso.mjs';

// Reinos que entran en el diario (S10 los agrega a medida que estén listos, en el orden de la campaña)
export const KINGDOMS = ['humano'];
// Reglas extra del día (S10 implementa los efectos y puede cambiar/agregar; S06 los textos). 'normal' = sin regla.
// El cliente que no conozca un id lo juega como 'normal'.
export const RULES = [
  { id: 'normal', texto: 'Sin regla extra' },
  { id: 'otra_raza', texto: 'Todas tus cartas son de otra raza' },
  { id: 'enemigos_fuertes', texto: 'Los enemigos empiezan con +10 de castillo' },
  { id: 'oro_doble', texto: 'El botín de oro es doble, pero no hay mercader' },
  { id: 'maldicion', texto: 'Empezás con una maldición en el mazo' },
  { id: 'fogata_debil', texto: 'Las fogatas curan la mitad' },
  { id: 'mano_extra', texto: 'Robás una carta más, pero tu castillo empieza 5 más bajo' },
];
export const MAX_FLOOR = 10, WIN_MIN_FLOOR = 9;   // piso = nodos superados del mapa (9-10); ganar = vencer al rey del reino
const GRACE_MS = 3 * 3600e3;                        // el resultado de un intento se acepta hasta 3 h después de terminar su día
const MIN_MS_PER_FLOOR = Number(process.env.DIARIO_MIN_MS ?? 15e3);                      // validación: al menos 15 s por piso alcanzado

const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
const dayOf = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const validDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z'));

// Configuración del día (igual para todos)
export function dayInfo(day = dayOf()) {
  if (!validDay(day)) day = dayOf();
  const start = Date.parse(day + 'T00:00:00Z'), n = Math.floor(start / 864e5);
  const seed = fnv('thrones-diario|' + day);
  return { day, seed, kingdom: KINGDOMS[n % KINGDOMS.length], rule: RULES[fnv('regla|' + day) % RULES.length], start, end: start + 864e5, today: day === dayOf() };
}

let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    get: db.prepare('SELECT * FROM daily WHERE day = ? AND player = ?'),
    ins: db.prepare('INSERT INTO daily (day, player, token, started) VALUES (?, ?, ?, ?)'),
    fin: db.prepare('UPDATE daily SET finished = ?, kingdom = ?, floor = ?, won = ?, turns = ?, castle = ? WHERE day = ? AND player = ? AND finished IS NULL'),
    top: db.prepare(`SELECT d.*, p.pub, p.name FROM daily d JOIN players p ON p.id = d.player WHERE d.day = ? AND d.finished IS NOT NULL AND p.hidden = 0
      ORDER BY d.won DESC, d.floor DESC, d.castle DESC, d.turns ASC, (d.finished - d.started) ASC LIMIT ?`),
    count: db.prepare('SELECT COUNT(*) AS n FROM daily d JOIN players p ON p.id = d.player WHERE d.day = ? AND d.finished IS NOT NULL AND p.hidden = 0'),
    better: db.prepare(`SELECT COUNT(*) AS n FROM daily d JOIN players p ON p.id = d.player WHERE d.day = ? AND d.finished IS NOT NULL AND p.hidden = 0 AND (
      d.won > ? OR (d.won = ? AND (d.floor > ? OR (d.floor = ? AND (d.castle > ? OR (d.castle = ? AND (d.turns < ? OR (d.turns = ? AND d.finished - d.started < ?))))))))`),
    days: db.prepare('SELECT day, COUNT(*) AS n FROM daily WHERE finished IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 30'),
    started: db.prepare('SELECT COUNT(*) AS n FROM daily WHERE day = ?'),
  });
};
const row = (r, i) => ({ pos: i + 1, pub: r.pub, name: r.name, won: !!r.won, floor: r.floor, castle: r.castle, turns: r.turns, secs: Math.round((r.finished - r.started) / 1000) });
const posOf = (r) => st().better.get(r.day, r.won, r.won, r.floor, r.floor, r.castle, r.castle, r.turns, r.turns, r.finished - r.started).n + 1;
const result = (r) => (r.finished ? { won: !!r.won, floor: r.floor, castle: r.castle, turns: r.turns, pos: posOf(r), of: st().count.get(r.day).n } : null);

// Empezar el intento de hoy. Si ya lo empezó y no lo terminó, devuelve el mismo (por si recargó). Si ya lo terminó: error.
export function start({ pid, ptoken, name }) {
  if (!st()) return { error: 'sin base' };
  const p = DB.auth(pid, ptoken, name ? cleanName(name) : null); if (!p) return { error: 'identidad' };
  const info = dayInfo(), r = st().get.get(info.day, p.id);
  if (r?.finished) return { error: 'ya jugaste', ...info, result: result(r) };
  if (r) return { ok: true, resumed: true, ...info, attempt: r.token, startedAt: r.started };
  const token = crypto.randomBytes(12).toString('base64url'), t = Date.now();
  st().ins.run(info.day, p.id, token, t);
  return { ok: true, resumed: false, ...info, attempt: token, startedAt: t };
}

// Estado de hoy del jugador (sin crear intento)
export function mine({ pid, ptoken }) {
  if (!st()) return { error: 'sin base' };
  const p = DB.auth(pid, ptoken, null); if (!p) return { error: 'identidad' };
  const info = dayInfo(), r = st().get.get(info.day, p.id);
  return { ...info, started: !!r, finished: !!r?.finished, result: r ? result(r) : null };
}

const int = (v) => (Number.isInteger(v) ? v : typeof v === 'string' && /^-?\d+$/.test(v) ? Number(v) : NaN);
// Cerrar el intento con el resultado. Validación básica: intento propio y abierto, a tiempo, reino del día, números posibles.
export function finish({ pid, ptoken, attempt, kingdom, floor, won, turns, castle }) {
  if (!st()) return { error: 'sin base' };
  const p = DB.auth(pid, ptoken, null); if (!p) return { error: 'identidad' };
  const now = Date.now();
  // el intento puede ser de hoy o de ayer (si se empezó antes de medianoche UTC, dentro del margen)
  const r = [dayOf(now), dayOf(now - GRACE_MS)].map((d) => st().get.get(d, p.id)).find((x) => x && x.token === attempt);
  if (!r) return { error: 'intento' };
  if (r.finished) return { error: 'ya jugaste', result: result(r) };
  const info = dayInfo(r.day);
  if (now > info.end + GRACE_MS) return { error: 'tarde' };
  floor = int(floor); turns = int(turns); castle = int(castle); won = won === true || won === 1 || won === '1' || won === 'true';
  if (kingdom !== info.kingdom) return { error: 'reino' };
  if (!(floor >= 0 && floor <= MAX_FLOOR)) return { error: 'piso' };
  if (won && floor < WIN_MIN_FLOOR) return { error: 'piso' };
  if (!(turns >= Math.max(1, floor) && turns <= 3000)) return { error: 'turnos' };
  if (!(castle >= 0 && castle <= 300) || (won && castle === 0)) return { error: 'castillo' };
  if (now - r.started < floor * MIN_MS_PER_FLOOR) return { error: 'muy rápido' };
  st().fin.run(now, kingdom, floor, won ? 1 : 0, turns, castle, r.day, p.id);
  return { ok: true, day: r.day, result: result(st().get.get(r.day, p.id)) };
}

// Ranking de un día (por defecto hoy): ganar > piso > castillo final > menos turnos > menos tiempo
export function ranking(day = null, limit = 50) {
  const info = dayInfo(validDay(day) ? day : dayOf());
  if (!st()) return { ...info, players: 0, days: [info.day], rows: [] };
  limit = Math.max(1, Math.min(100, Number(limit) || 50));
  const days = [...new Set([dayOf(), ...st().days.all().map((x) => x.day)])].sort().reverse();
  return { ...info, players: st().count.get(info.day).n, attempts: st().started.get(info.day).n, days, rows: st().top.all(info.day, limit).map(row) };
}
