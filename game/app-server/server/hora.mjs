// "Hora del asedio" (S08, decidido por Juan 17/11): todos los SÁBADOS de 18:00 a 20:00 de Argentina (21:00-23:00 UTC;
// Argentina no cambia de hora). En esa ventana, el que juega 3 partidas online con ranking (personas, fantasmas o bots)
// gana una vez el MARCO DE PERFIL "Hora del asedio" (queda en `premios`; se va a ver cuando exista la pestaña Marco de
// perfil en Personalizar y el arte del marco, S04). La idea es juntar gente a la misma hora para que haya rivales.
// Cuenta una partida si duró 4 turnos o más y el jugador no la abandonó.
// Para probar: HORA_SIEMPRE=1 (ventana siempre abierta).
import * as DB from './db.mjs';

export const HORA = { diaUTC: 6, desdeUTC: 21 * 60, hastaUTC: 23 * 60 }; // sábado (UTC), minutos del día
export const META = 3, PREMIO = 'marco_asedio';
const MIN = 60e3, DAY = 864e5;

// Ventana actual (si está abierta) o la próxima: { activa, desde, hasta } en ms
export function ventana(now = Date.now()) {
  if (process.env.HORA_SIEMPRE === '1') { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return { activa: true, desde: +d, hasta: +d + DAY }; }
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0);
  const back = (d.getUTCDay() - HORA.diaUTC + 7) % 7;
  let ini = +d - back * DAY + HORA.desdeUTC * MIN, fin = +d - back * DAY + HORA.hastaUTC * MIN;
  if (now >= fin) { ini += 7 * DAY; fin += 7 * DAY; }
  return { activa: now >= ini && now < fin, desde: ini, hasta: fin };
}

let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    add: db.prepare('INSERT INTO hora_partidas (player, ventana, ts) VALUES (?, ?, ?)'),
    count: db.prepare('SELECT COUNT(*) AS n FROM hora_partidas WHERE player = ? AND ventana = ?'),
    premio: db.prepare('SELECT 1 FROM premios WHERE player = ? AND item = ?'),
    dar: db.prepare('INSERT OR IGNORE INTO premios (player, item, ts) VALUES (?, ?, ?)'),
    premios: db.prepare('SELECT item, ts FROM premios WHERE player = ? ORDER BY ts'),
    jugaron: db.prepare('SELECT COUNT(DISTINCT player) AS n FROM hora_partidas WHERE ventana = ?'),
  });
};
export function progreso(pid, now = Date.now()) {
  const v = ventana(now), out = { ...v, meta: META, jugadas: 0, premio: false };
  if (!st() || !pid) return out;
  out.premio = !!st().premio.get(pid, PREMIO);
  if (v.activa) out.jugadas = Math.min(META, st().count.get(pid, v.desde).n);
  return out;
}
// Al terminar una partida online con ranking. Devuelve el progreso (con nuevo: true si justo ganó el marco) o null.
export function partida(pid, { turns, abandono }) {
  const v = ventana(); if (!v.activa || !st() || !pid || abandono || turns < 4) return null;
  st().add.run(pid, v.desde, Date.now());
  const p = progreso(pid); let nuevo = false;
  if (p.jugadas >= META && !p.premio) { st().dar.run(pid, PREMIO, Date.now()); p.premio = nuevo = true; }
  return { ...p, nuevo };
}
export const premios = (pid) => (st() ? st().premios.all(pid) : []);
export const jugaronEsta = () => { const v = ventana(); return v.activa && st() ? st().jugaron.get(v.desde).n : 0; };
