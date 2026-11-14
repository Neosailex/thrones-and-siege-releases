// Texto y costo "reales" de una carta para el jugador que la ve: costo con descuentos (E.costOf, incluye manga)
// y los números del texto reemplazados por los que de verdad hace con pasivas/efectos (E.cardVectors).
// Fuente única: la usan la UI (client/src/main.js) y la auditoría (tools/balance/audit_cards.mjs).
// V = vista de viewFor (+ V.cycled), SEATRACE = [raza asiento 0, raza asiento 1]. Devuelve { c, tx } o null.
// Puro: sin DOM ni Node.
// (S03 11/11, idiomas) El texto ya no se lee en castellano para saber qué número cambiar: cada carta tiene una PLANTILLA con los números marcados
//   {o6} daño (lo que le hace al rival: o0..o7 = constructores, ladrillos, soldados, armas, magos, cristales, muro/daño, castillo/directo)
//   {s6} muro propio (s0..s7, lo mismo para vos) · {thief} tope del Bandido de caminos (9)
// Los números sin marca quedan fijos (turnos, condiciones…). La plantilla castellana sale sola del texto de NAMES (templateOf);
// cada idioma escribe la suya con las mismas marcas (formato en docs/idiomas/plan.md) y se la pasa a realOf con opt.tpl.
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
export function desgloseTxt(D, lado, k, W = null) { const P = partes(D, lado, k); if (!P || !P.partes.length) return null; const lbl = (l) => (W ? W.race?.[l] || (l === 'Tambores' ? W.drums : l === 'efectos' ? W.effects : l) : l); return `${P.base} ${P.partes.map(([n, l]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${lbl(l)}`).join(' ')} = ${P.total}`; }

const KW = { 6: /muro|daño/i, 7: /castillo|directo/i, 1: /ladrillo|cada recurso/i, 3: /arma|cada recurso/i, 5: /cristal|cada recurso/i, 0: /constructor|cada unidad/i, 2: /soldado|cada unidad/i, 4: /mago|cada unidad/i };
// Palabras que realOf agrega al texto (por idioma; si falta una, sale la castellana). S06 completa los otros idiomas.
export const CARD_WORDS = {
  es: { now: 'ahora', base: 'Base', bonus: 'con tus bonus queda', direct: 'directo al castillo', and: 'y', gnome: 'Pasiva gnoma: contra un muro de 25 o más', race: { orco: 'orco', enano: 'enano', drow: 'drow', elfo: 'elfo', gnomo: 'gnomo', humano: 'humano' }, drums: 'Tambores', effects: 'efectos' },
  en: { now: 'now', base: 'Base', bonus: 'with your bonuses it is', direct: 'direct to the castle', and: 'and', gnome: 'Gnome passive: against a wall of 25 or more', race: { orco: 'orc', enano: 'dwarf', drow: 'drow', elfo: 'elf', gnomo: 'gnome', humano: 'human' }, drums: 'Drums', effects: 'effects' },
  'zh-Hans': { now: '现在', base: '基础', bonus: '加上你的加成后为', direct: '直接对城堡', and: '和', gnome: '侏儒被动：对抗 25 或以上的城墙', race: { orco: '兽人', enano: '矮人', drow: '黑暗精灵', elfo: '精灵', gnomo: '侏儒', humano: '人类' }, drums: '战鼓', effects: '效果' },   // S06 12/11
  ru: { now: 'сейчас', base: 'База', bonus: 'с твоими бонусами', direct: 'прямо по замку', and: 'и', gnome: 'Пассивка гномов: против стены 25 и выше', race: { orco: 'орк', enano: 'дворф', drow: 'дроу', elfo: 'эльф', gnomo: 'гном', humano: 'человек' }, drums: 'Барабаны', effects: 'эффекты' },   // S06 13/11,
  'pt-BR': { now: 'agora', base: 'Base', bonus: 'com seus bônus fica', direct: 'direto no castelo', and: 'e', gnome: 'Passiva gnoma: contra uma muralha de 25 ou mais', race: { orco: 'orc', enano: 'anão', drow: 'drow', elfo: 'elfo', gnomo: 'gnomo', humano: 'humano' }, drums: 'Tambores', effects: 'efeitos' },   // S06 13/11
};
const wordsOf = (opt) => ({ ...CARD_WORDS.es, ...(CARD_WORDS[opt?.lang] || {}), ...(opt?.words || {}) });

// Plantilla castellana de una carta (con cache): marca cada número del texto que sale de un vector de la carta. Misma regla que antes:
// el número se marca sólo si su cláusula (entre comas, punto y coma, punto o " y ") nombra ese recurso, y no es del otro lado.
const TPL = new Map();
export function templateOf(id) {
  if (TPL.has(id)) return TPL.get(id);
  let tx = NAMES[id]?.[1] ?? ''; const cv = CARDS[id];
  if (cv && !COND_MAIN[id]) {
    const [, s0, o0] = cv;
    const clauseAt = (at) => { const L = tx.slice(0, at), R = tx.slice(at); const a = Math.max(L.lastIndexOf(','), L.lastIndexOf(';'), L.lastIndexOf('.'), L.lastIndexOf(' y ')); const m = R.search(/[,;.]| y /); return tx.slice(a + 1, m < 0 ? tx.length : at + m); };
    const mark = (v0, key, k, self = false) => {
      if (!v0) return; const re = new RegExp(`(^|[^\\d\u0000\u0001])(${v0})(?![\\d\u0001])`, 'g'); let m;
      const kw = self && k === 6 ? /muro/i : KW[k];
      while ((m = re.exec(tx))) { const at = m.index + m[1].length; const cl = clauseAt(at); if (kw.test(cl) && !(self ? /rival/i : /\bvos\b|\btu\b/i).test(cl.replace(/directo al castillo rival/i, ''))) { tx = tx.slice(0, at) + '\u0000' + key + '\u0001' + tx.slice(at + String(v0).length); return; } }
    };
    if (id === 9) mark(8, 'thief', 1);
    for (const k of [6, 7, 1, 3, 5, 0, 2, 4]) mark(o0[k], 'o' + k, k);
    for (const k of [6, 7, 1, 3, 5]) mark(s0[k], 's' + k, k, true);
    tx = tx.replace(/\u0000(\w+)\u0001/g, '{$1}');
  }
  TPL.set(id, tx); return tx;
}
// valor de base de una marca
export function baseOfMark(id, key) { if (key === 'thief') return 8; const [, s0, o0] = CARDS[id]; return (key[0] === 'o' ? o0 : s0)[+key.slice(1)]; }
// texto de base (sin partida: editor de mazos, compendio) de una plantilla en cualquier idioma
export function baseText(id, tpl = templateOf(id)) { return tpl.replace(/\{(\w+)\}/g, (m, k) => String(baseOfMark(id, k))); }
// secuencia de números de un texto: marcas como su nombre y números sueltos como el número (para comparar idiomas)
export function numbersOf(tpl) { return [...String(tpl).matchAll(/\{(\w+)\}|\d+/g)].map((m) => (m[1] ? '{' + m[1] + '}' : m[0])); }

export function realOf(V, SEATRACE, id, sleeve = false, opt = {}) { // opt.desglose: el número muestra de dónde sale ("8 +1 orco = 9") · opt.lang / opt.tpl / opt.words: idioma // sleeve: costo desde la manga (sale de E.costOf)
  if (!V || !V.me || !V.op) return null;
  const race = (SEATRACE && SEATRACE[V.seat]) || null, me = { ...V.me, race }, op = { ...V.op, race: (SEATRACE && SEATRACE[1 - V.seat]) || null };
  let c, vec; try { c = E.costOf(me, id, sleeve); vec = E.cardVectors({ cycled: V.cycled }, me, op, id, sleeve); } catch { return null; }
  const W = wordsOf(opt), [, s0, o0] = CARDS[id], { s, op: o } = vec, tpl = opt.tpl ?? templateOf(id);
  const D = opt.desglose ? desgloseOf({ cycled: V.cycled }, me, op, id) : null;
  const lbl = (l) => W.race[l] || (l === 'Tambores' ? W.drums : l === 'efectos' ? W.effects : l);
  const conDesglose = (lado, k, v0, v) => { const P = D && partes(D, lado, k); return P && P.partes.length && P.base === v0 && P.total === v ? `${v0}<span class="rvd"> ${P.partes.map(([n, l]) => `${n > 0 ? '+' : '−'}${Math.abs(n)} ${lbl(l)}`).join(' ')} =</span> ${v}` : null; };
  const cm = COND_MAIN[id];
  // pasiva gnoma (máquinas de asedio): daño directo extra que el texto de la carta no menciona
  const extra = o[7] > 0 && !o0[7] && cm?.[1] !== 7 ? ` ${W.and} <b class="rv up" title="${W.gnome}">${o[7]} ${W.direct}</b>` : '';
  if (cm) { const v = (cm[0] === 'o' ? o : s)[cm[1]], P = D && partes(D, cm[0] === 'o' ? 'op' : 's', cm[1]); return { c, tx: baseText(id, tpl) + `${extra} <b class="rv">(${W.now} ${P && P.partes.length ? desgloseTxt(D, cm[0] === 'o' ? 'op' : 's', cm[1], W) : v})</b>` }; }
  const tx = tpl.replace(/\{(\w+)\}/g, (m, key) => {
    const v0 = baseOfMark(id, key); let v, lado, k;
    if (key === 'thief') { v = E.thiefCap(me); lado = 'op'; k = 1; } else { k = +key.slice(1); lado = key[0] === 'o' ? 'op' : 's'; v = (key[0] === 'o' ? o : s)[k]; }
    if (v === v0) return String(v0);
    return `<b class="rv ${v > v0 ? 'up' : 'dn'}" title="${W.base} ${v0}: ${W.bonus} ${v}">${conDesglose(lado, k, v0, v) || v}</b>`;
  });
  return { c, tx: tx + extra };
}
