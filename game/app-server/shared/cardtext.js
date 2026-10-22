// Texto y costo "reales" de una carta para el jugador que la ve: costo con descuentos (E.costOf, incluye manga)
// y los números del texto reemplazados por los que de verdad hace con pasivas/efectos (E.cardVectors).
// Fuente única: la usan la UI (client/src/main.js) y la auditoría (tools/balance/audit_cards.mjs).
// V = vista de viewFor (+ V.cycled), SEATRACE = [raza asiento 0, raza asiento 1]. Devuelve { c, tx } o null.
// Puro: sin DOM ni Node.
import * as E from './engine.js';
import { CARDS, NAMES } from './cards.js';

const COND_MAIN = { 121: ['o', 6], 157: ['o', 6], 158: ['s', 6], 159: ['o', 6], 160: ['s', 5], 161: ['s', 7], 162: ['o', 6], 173: ['s', 5], 174: ['o', 6], 178: ['o', 6] };
export function realOf(V, SEATRACE, id, sleeve = false) { // sleeve: costo desde la manga (1/3 más, sale de E.costOf)
  if (!V || !V.me || !V.op) return null;
  const race = (SEATRACE && SEATRACE[V.seat]) || null, me = { ...V.me, race }, op = { ...V.op, race: (SEATRACE && SEATRACE[1 - V.seat]) || null };
  let c, vec; try { c = E.costOf(me, id, sleeve); vec = E.cardVectors({ cycled: V.cycled }, me, op, id); } catch { return null; }
  const [, s0, o0] = CARDS[id], { s, op: o } = vec; let tx = NAMES[id][1];
  const cm = COND_MAIN[id];
  // pasiva gnoma (máquinas de asedio): daño directo extra que el texto de la carta no menciona
  const extra = o[7] > 0 && !o0[7] ? ` y <b class="rv up" title="Pasiva gnoma: contra un muro de 25 o más">${o[7]} directo al castillo</b>` : '';
  if (cm) { const v = (cm[0] === 'o' ? o : s)[cm[1]]; tx += `${extra} <b class="rv">(ahora ${v})</b>`; }
  else {
    const toks = [];
    // el número se reemplaza sólo si su cláusula (entre comas, punto y coma o " y ") nombra ese recurso
    const KW = { 6: /muro|daño/i, 7: /castillo|directo/i, 1: /ladrillo|cada recurso/i, 3: /arma|cada recurso/i, 5: /cristal|cada recurso/i, 0: /constructor|cada unidad/i, 2: /soldado|cada unidad/i, 4: /mago|cada unidad/i };
    const clauseAt = (at) => { const L = tx.slice(0, at), R = tx.slice(at); const a = Math.max(L.lastIndexOf(','), L.lastIndexOf(';'), L.lastIndexOf('.'), L.lastIndexOf(' y ')); const m = R.search(/[,;.]| y /); return tx.slice(a + 1, m < 0 ? tx.length : at + m); };
    const sub = (v0, v, k, self = false) => {
      if (v0 === v || !v0) return; const re = new RegExp(`(^|[^\\d\u0000\u0001])(${v0})(?![\\d\u0001])`, 'g'); let m, pick = null;
      const kw = self && k === 6 ? /muro/i : KW[k];
      while ((m = re.exec(tx))) { const at = m.index + m[1].length; const cl = clauseAt(at); if (kw.test(cl) && !(self ? /rival/i : /\bvos\b|\btu\b/i).test(cl.replace(/directo al castillo rival/i, ''))) { pick = at; break; } }
      if (pick == null) return; const at = pick;
      toks.push(`<b class="rv ${v > v0 ? 'up' : 'dn'}" title="Base ${v0}: con tus bonus queda ${v}">${v}</b>`);
      tx = tx.slice(0, at) + '\u0000' + (toks.length - 1) + '\u0001' + tx.slice(at + String(v0).length);
    };
    if (id === 9 && E.thiefCap(me) !== 8) sub(8, E.thiefCap(me), 1);
    for (const k of [6, 7, 1, 3, 5, 0, 2, 4]) sub(o0[k], o[k], k);
    for (const k of [6, 7, 1, 3, 5]) sub(s0[k], s[k], k, true);
    tx = tx.replace(/\u0000(\d+)\u0001/g, (m, n) => toks[+n]) + extra;
  }
  return { c, tx };
}
