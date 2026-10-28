// Texto y costo "reales" de una carta para el jugador que la ve: costo con descuentos (E.costOf, incluye manga)
// y los números del texto reemplazados por los que de verdad hace con pasivas/efectos (E.cardVectors).
// Fuente única: la usan la UI (client/src/main.js) y la auditoría (tools/balance/audit_cards.mjs).
// V = vista de viewFor (+ V.cycled), SEATRACE = [raza asiento 0, raza asiento 1]. Devuelve { c, tx } o null.
// Puro: sin DOM ni Node.
import * as E from './engine.js';
import { CARDS, NAMES } from './cards.js';

const COND_MAIN = { 188: ['o', 7], 121: ['o', 6], 157: ['o', 6], 158: ['s', 6], 159: ['o', 6], 160: ['s', 5], 161: ['s', 7], 162: ['o', 6], 173: ['s', 5], 174: ['o', 6], 178: ['o', 6] };
// (Juan 25/10) de dónde sale cada número: base de la carta → + pasiva de tu raza → + efectos (Tambores). desgloseOf devuelve
// los tres vectores; partes(D, 's'|'op', k) = { base, partes: [[+n, 'orco'], …], total } (vacío si no cambia).
const RAZA_CORTA = { orco: 'orco', enano: 'enano', drow: 'drow', elfo: 'elfo', gnomo: 'gnomo', humano: 'humano' };
export function desgloseOf(g, p, o, id) {
  try { return { b: E.cardVectors(g, { ...p, race: null, effects: [] }, o, id), r: E.cardVectors(g, { ...p, effects: [] }, o, id), f: E.cardVectors(g, p, o, id), raza: p.race || null, tambores: !!p.effects?.some((e) => e.e === 'drums') }; } catch { return null; }
}
export function partes(D, lado, k) {
  if (!D) return null; const base = D.b[lado][k], r = D.r[lado][k], t = D.f[lado][k], out = [];
  if (r !== base) out.push([r - base, RAZA_CORTA[D.raza] || 'raza']);
  if (t !== r) out.push([t - r, D.tambores ? 'Tambores' : 'efectos']);
  return { base, partes: out, total: t };
}
// "8 +1 orco = 9" (texto plano; null si no hay pasivas/efectos en ese número)
export function desgloseTxt(D, lado, k) { const P = partes(D, lado, k); if (!P || !P.partes.length) return null; return `${P.base} ${P.partes.map(([n, l]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${l}`).join(' ')} = ${P.total}`; }

export function realOf(V, SEATRACE, id, sleeve = false, opt = {}) { // opt.desglose: el número muestra de dónde sale ("8 +1 orco = 9"); la auditoría usa el formato corto // sleeve: costo desde la manga (1/3 más, sale de E.costOf)
  if (!V || !V.me || !V.op) return null;
  const race = (SEATRACE && SEATRACE[V.seat]) || null, me = { ...V.me, race }, op = { ...V.op, race: (SEATRACE && SEATRACE[1 - V.seat]) || null };
  let c, vec; try { c = E.costOf(me, id, sleeve); vec = E.cardVectors({ cycled: V.cycled }, me, op, id, sleeve); } catch { return null; }
  const [, s0, o0] = CARDS[id], { s, op: o } = vec; let tx = NAMES[id][1];
  const D = opt.desglose ? desgloseOf({ cycled: V.cycled }, me, op, id) : null;
  const conDesglose = (lado, k, v0, v) => { const P = D && partes(D, lado, k); return P && P.partes.length && P.base === v0 && P.total === v ? `${v0}<span class="rvd"> ${P.partes.map(([n, l]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${l}`).join(' ')} =</span> ${v}` : null; };
  const cm = COND_MAIN[id];
  // pasiva gnoma (máquinas de asedio): daño directo extra que el texto de la carta no menciona
  const extra = o[7] > 0 && !o0[7] && COND_MAIN[id]?.[1] !== 7 ? ` y <b class="rv up" title="Pasiva gnoma: contra un muro de 25 o más">${o[7]} directo al castillo</b>` : '';
  if (cm) { const v = (cm[0] === 'o' ? o : s)[cm[1]], P = D && partes(D, cm[0] === 'o' ? 'op' : 's', cm[1]); tx += `${extra} <b class="rv">(ahora ${P && P.partes.length ? desgloseTxt(D, cm[0] === 'o' ? 'op' : 's', cm[1]) : v})</b>`; }
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
      toks.push(`<b class="rv ${v > v0 ? 'up' : 'dn'}" title="Base ${v0}: con tus bonus queda ${v}">${conDesglose(self ? 's' : 'op', k, v0, v) || v}</b>`);
      tx = tx.slice(0, at) + '\u0000' + (toks.length - 1) + '\u0001' + tx.slice(at + String(v0).length);
    };
    if (id === 9 && E.thiefCap(me) !== 8) sub(8, E.thiefCap(me), 1);
    for (const k of [6, 7, 1, 3, 5, 0, 2, 4]) sub(o0[k], o[k], k);
    for (const k of [6, 7, 1, 3, 5]) sub(s0[k], s[k], k, true);
    tx = tx.replace(/\u0000(\d+)\u0001/g, (m, n) => toks[+n]) + extra;
  }
  return { c, tx };
}
