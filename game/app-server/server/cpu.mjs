// CPU por el que se desconecta (S08, idea de Juan 18/11). Si a alguien se le corta internet o se queda sin batería en
// una partida online, la CPU (Normal) juega por él al instante: el rival no espera. Si vuelve, retoma el control; si no,
// la CPU termina la partida y, cuando el jugador vuelve a entrar, le contamos cómo le fue ("la CPU jugó 7 turnos por vos y ganó: +9").
// - "Abandonar" (salir a propósito) sigue siendo derrota: la CPU solo entra cuando se corta la conexión.
// - Antitrampa: si la CPU jugó más de la mitad de sus turnos, ese jugador gana/pierde la MITAD de puntos (el rival, completos)
//   y no le cuenta para la Hora del asedio. Si se viene cortando seguido (3+ cortes en 24 h), y gana así, no suma.
import * as DB from './db.mjs';

export const CORTES_MAX = 3, DAY = 864e5;
let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    caida: db.prepare('INSERT INTO caidas (player, ts) VALUES (?, ?)'),
    cortes: db.prepare('SELECT COUNT(*) AS n FROM caidas WHERE player = ? AND ts > ?'),
    clean: db.prepare('DELETE FROM caidas WHERE ts < ?'),
    inf: db.prepare('INSERT INTO cpu_informe (player, rival, turnos, total, gano, delta, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    unseen: db.prepare('SELECT * FROM cpu_informe WHERE player = ? AND seen = 0 ORDER BY ts DESC LIMIT 5'),
    seen: db.prepare('UPDATE cpu_informe SET seen = 1 WHERE player = ? AND seen = 0'),
  });
};
export function corte(pid) { try { if (pid && st()) { st().caida.run(pid, Date.now()); st().clean.run(Date.now() - 7 * DAY); } } catch {} }
export const cortesHoy = (pid) => { try { return pid && st() ? st().cortes.get(pid, Date.now() - DAY).n : 0; } catch { return 0; } };
// Cuánto de los puntos le cuentan a este asiento
export function escala({ cpuTurns, myTurns, won, pid }) {
  if (!cpuTurns || !myTurns || cpuTurns * 2 <= myTurns) return 1;
  if (won && cortesHoy(pid) >= CORTES_MAX) return 0;
  return 0.5;
}
// Informe para cuando vuelva (si terminó la partida sin él)
export function informe({ pid, rival, turnos, total, gano, delta }) { try { if (pid && st()) st().inf.run(pid, rival || '', turnos, total, gano ? 1 : 0, delta ?? null, Date.now()); } catch {} }
export function novedades(pid) {
  if (!st()) return []; const r = st().unseen.all(pid); if (r.length) st().seen.run(pid);
  return r.map((x) => ({ rival: x.rival, turnos: x.turnos, total: x.total, gano: !!x.gano, delta: x.delta, ts: x.ts }));
}
