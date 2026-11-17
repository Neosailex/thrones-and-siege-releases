// Sets de fondo en el perfil (S08, 16/11; reglas en docs/arte/sets-de-fondo.md).
// - Cada jugador elige en su perfil un set desbloqueado; el A es de todos (por defecto). El set NO depende de la raza.
// - Los desbloquea la campaña (S10): el juego avisa con /api/fondos/desbloquear y el servidor lo anota. La campaña se juega
//   en el dispositivo, así que el servidor confía en ese aviso (igual que con el progreso en la nube); lo que sí controla
//   es que en la partida solo se use un set que ese jugador tiene anotado.
// - En la partida, el servidor manda el set de cada asiento (`fondos` en 'start'); el cliente dibuja mitad y mitad.
// Los ids son los de client/src/game/fondos.js (misma lista; acá no se importa del cliente porque el servidor va solo).
import * as DB from './db.mjs';

export const SET_IDS = ['a', 'a_corr', 'b', 'b_corr', 'c', 'c_corr', 'd', 'd_corr', 'e', 'e_corr', 'f', 'f_corr', 'g', 'g_corr'];
export const FONDO_BASE = 'a';
const valido = (id) => SET_IDS.includes(id);

let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    list: db.prepare('SELECT set_id FROM fondos WHERE player = ?'),
    has: db.prepare('SELECT 1 FROM fondos WHERE player = ? AND set_id = ?'),
    add: db.prepare('INSERT OR IGNORE INTO fondos (player, set_id, ts) VALUES (?, ?, ?)'),
    get: db.prepare('SELECT fondo FROM players WHERE id = ?'),
    put: db.prepare('UPDATE players SET fondo = ? WHERE id = ?'),
  });
};
export const tiene = (pid, id) => id === FONDO_BASE || (valido(id) && !!st()?.has.get(pid, id));
export function estado(pid) {
  if (!st()) return { fondo: FONDO_BASE, desbloqueados: [FONDO_BASE] };
  const des = [FONDO_BASE, ...st().list.all(pid).map((r) => r.set_id).filter(valido)];
  const f = st().get.get(pid)?.fondo; return { fondo: des.includes(f) ? f : FONDO_BASE, desbloqueados: SET_IDS.filter((x) => des.includes(x)) };
}
export function desbloquear(pid, ids) {
  if (!st()) return estado(pid);
  for (const id of (Array.isArray(ids) ? ids : []).slice(0, SET_IDS.length)) if (valido(id) && id !== FONDO_BASE) st().add.run(pid, id, Date.now());
  return estado(pid);
}
export function elegir(pid, id) {
  if (!st()) return { error: 'sin base' };
  if (!tiene(pid, id)) return { error: 'bloqueado', err: 'fondo.locked' };
  st().put.run(id, pid); return { ok: true, ...estado(pid) };
}
// El set con el que juega este jugador: el que pide el cliente si lo tiene; si no, el de su perfil
export function paraPartida(pid, pedido) {
  if (pid && pedido && tiene(pid, pedido)) return pedido;
  return pid ? estado(pid).fondo : FONDO_BASE;
}
