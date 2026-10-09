// Motor del Asedio. Sin dependencias de DOM ni de red: lo usan el servidor y el cliente.
import { CARDS, SPECIAL, FX, DEFAULT_DECK, DEFAULT_RES, HAND, KINGS, FAVOR_MAX, ARROW_IDS, MELEE_IDS, RAPID, GNOME_MACHINES } from './cards.js';

const KEYS = ['builder', 'brick', 'recruit', 'weapon', 'mage', 'crystal', 'wall', 'castle'];
export const stats = (p) => KEYS.map((k) => p[k]);

function shuffle(a, rnd) { let n = a.length; if (!n) return; while (--n) { const j = Math.floor(rnd() * (n + 1)); [a[n], a[j]] = [a[j], a[n]]; } }

function makePlayer(counts, res, rnd) {
  const p = { ...res, noDamage: false, x2: false, statsType: 0, deck: [], used: [], hand: [] };
  counts.forEach((n, i) => { for (let k = 0; k < n; k++) p.deck.push(i + 1); });
  shuffle(p.deck, rnd);
  return p;
}

export function newGame({ starter = 0, rnd = Math.random, decks = [DEFAULT_DECK, DEFAULT_DECK], res = DEFAULT_RES, races = [null, null], dev = false } = {}) {
  const g = { players: [makePlayer(decks[0], res, rnd), makePlayer(decks[1], res, rnd)], turn: starter, pending: null, winner: null, turnNo: 1, cycled: false, extraTurn: false, dev: dev ? { infinite: true, noWin: true } : null };
  g.players[0].race = races[0] || null; g.players[1].race = races[1] || null;
  for (const p of g.players) { p.kingCharge = 0; p.kingStun = 0; p.kingGuard = false; p.favor = 0; p.trap = null; p.effects = []; p.lastDamage = 0; p.dmgRound = 0; p.kingDouble = false; p.luto = false; } if (dev) { g.players[0].devRace = races[0] || null; g.players[1].devRace = races[1] || null; }
  for (const p of g.players) {
    for (let i = 0; i < HAND; i++) p.hand.push(draw(g, p, rnd));
    // mano inicial garantizada: si hay menos de 2 cartas jugables, se reparte de nuevo (hasta 3 veces)
    for (let k = 0; k < 3 && p.hand.filter((id) => playable(p, id)).length < 2; k++) { p.deck.push(...p.hand); p.hand = []; shuffle(p.deck, rnd); for (let i = 0; i < HAND; i++) p.hand.push(draw(g, p, rnd)); }
  }
  g._rnd = rnd; devClamp(g);
  return g;
}

function draw(g, p, rnd = g._rnd) {
  if (!p.deck.length) { p.deck = p.used.slice(); p.used = []; shuffle(p.deck, rnd); }
  return p.deck.pop();
}
function validate(p) {
  p.builder = p.builder <= 0 ? 1 : p.builder; p.recruit = p.recruit <= 0 ? 1 : p.recruit; p.mage = p.mage <= 0 ? 1 : p.mage;
  p.brick = Math.max(0, p.brick); p.weapon = Math.max(0, p.weapon); p.crystal = Math.max(0, p.crystal);
  if (p.wall < 0) { p.castle += p.wall; p.wall = 0; }
  if (p.castle <= 0) p.castle = 0;
}
function statAdd(p, a) { KEYS.forEach((k, i) => { p[k] += a[i]; }); validate(p); }
function statRemove(g, p, a, keep, fx) {
  for (let i = 0; i < 6; i++) p[KEYS[i]] -= a[i];
  const o = other(g, p), hits = a[6] > 0 || a[7] > 0;
  if (hits && g.turn !== g.players.indexOf(p)) { const w0 = p.wall, c0 = p.castle; queueMicrotask?.(() => {}); p._w0 = w0; p._c0 = c0; }
  if (!p.noDamage) {
    const m = o.x2 && hits ? 2 : 1; if (m === 2) { if (!keep) o.x2 = false; fx.push('double'); }
    let dw = a[6] * m; const dc = a[7] * m;
    // enanos: el muro recibe 20% menos; lo que lo atraviesa le pega entero al castillo
    if (p.race === 'enano' && dw > 0 && g.turn !== g.players.indexOf(p)) { const need = Math.ceil(Math.max(0, p.wall) / 0.8); dw = dw <= need ? Math.ceil(dw * 0.8) : Math.max(0, p.wall) + (dw - need); }
    p.wall -= dw; p.castle -= dc;
  } else {
    if (o.x2 && hits && !keep) o.x2 = false;
    if (hits && !keep) { p.noDamage = false; fx.push('shield'); }
  }
  validate(p);
}
const other = (g, p) => (p === g.players[0] ? g.players[1] : g.players[0]);

// Costo efectivo según la raza (elfos: hechizos 1 cristal menos; gnomos: cartas de armas 1 menos)
export function costOf(p, id) {
  const c = CARDS[id][0].slice();
  if (p.race === 'elfo' && c[5] > 0) c[5] = Math.max(1, c[5] - 2);
  if (p.race === 'gnomo' && c[3] >= 6) c[3] -= 2;
  if (p.luto && p.kingStun > 0) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] += 2;
  if (p.halfId === id) for (const i of [1, 3, 5, 8]) c[i] = 0; // invento del rey gnomo: gratis ese turno
  return c;
}
export function playable(p, id) {
  const s = stats(p), c = costOf(p, id);
  if (c[8] && (p.favor || 0) < c[8]) return false;
  for (let i = 0; i < 8; i++) if (s[i] < c[i]) return false;
  return !(s[0] <= c[0] || s[2] <= c[2] || s[4] <= c[4]);
}

// Juega la carta en la posición i de la mano del jugador de turno.
// Devuelve un evento para animar; si es Espía o Sabotaje deja g.pending y el turno sigue abierto.
function noteDamage(g, p) { if (p._w0 == null) return; const d = Math.max(0, (p._w0 - p.wall)) + Math.max(0, (p._c0 - p.castle)); p.dmgRound += d; p._w0 = p._c0 = null; }
// Vectores reales de una carta (condicionales, pasivas de raza y efectos), antes de trampas y Furia.
export function cardVectors(g, p, o, id) {
  let [, s, op] = CARDS[id]; s = s.slice(); op = op.slice(); const special = FX[id] || null;
  // condicionales: el efecto depende del estado
  if (special?.k === 'cond') {
    const bonus = {
      157: () => { op[6] = o.castle < 20 ? 20 : 10; },
      158: () => { s[6] = 6 + (p.castle < 25 ? 18 : 0); },
      159: () => { op[6] = p.recruit > o.recruit ? 16 : 8; },
      160: () => { s[5] = 6; if (p.mage >= 5) s[4] = 1; },
      161: () => { s[7] = 8 + (p.wall === 0 ? 8 : 0); },
      162: () => { op[6] = Math.min(20, p.lastDamage || 0); },
      173: () => { s[5] = g.cycled ? 12 : 5; },
      174: () => { op[6] = o.kingStun > 0 ? 16 : 8; },
      178: () => { op[6] = p.wall < 10 ? 16 : 10; },
    }[id]; if (bonus) bonus();
  }
  // pasivas de raza sobre los vectores
  if (p.race === 'enano' && s[6] > 0) s[6] += 2;
  if (p.race === 'orco' && s[6] > 0) s[6] = Math.max(0, s[6] - 1);
  if (p.race === 'orco' && op[6] + op[7] >= 6) { if (op[6] > 0) op[6] += 1; else op[7] += 1; }
  if (p.race === 'drow') for (const k of [1, 3, 5]) if (op[k] > 0) op[k] = op[k] * 2;
  // tambores de guerra: ataques +3
  if (p.effects?.some((e) => e.e === 'drums') && (op[6] > 0 || op[7] > 0)) { if (op[6] > 0) op[6] += 4; else op[7] += 4; }
  // asedio prolongado sobre mí: no puedo subir el muro
  let siege = false; if (p.effects?.some((e) => e.e === 'siegelock') && s[6] > 0) { s[6] = 0; siege = true; }
  return { s, op, siege };
}
export function play(g, i) {
  if (g.winner != null || g.pending) return null;
  const seat = g.turn, p = g.players[seat], o = other(g, p), id = p.hand[i];
  if (id == null || !playable(p, id)) return null;
  if (g.inExtra && FX[id]?.k === 'extraTurn') return null; // el Reloj no se encadena
  const c = costOf(p, id); if (p.halfId === id) p.halfId = null;
  const before = [stats(g.players[0]), stats(g.players[1])];
  const fx = [], special = FX[id] || null;
  p.used.push(id);
  const sp = SPECIAL[id];
  if (p.hand.length > HAND) p.hand.splice(i, 1); else p.hand[i] = draw(g, p); // la carta extra del rey elfo no se repone
  let { s, op, siege } = cardVectors(g, p, o, id); if (siege) fx.push('siegeLocked');
  // trampas del rival
  let cancelled = false;
  if (o.trap) {
    const t = o.trap, isSpell = c[5] > 0 && (op.some((v) => v > 0) || ['stunKing', 'drainKing', 'coin'].includes(special?.k)), isWeapon = c[3] > 0, isMelee = MELEE_IDS.has(id), isArrow = ARROW_IDS.has(id), hits = op[6] > 0 || op[7] > 0;
    let fired = false;
    if (t === 'moat' && isMelee && hits) { op[6] = Math.floor(op[6] / 2); op[7] = Math.floor(op[7] / 2); fired = true; }
    if (t === 'counterspell' && isSpell) { cancelled = true; o.crystal += 5; fired = true; }
    if (t === 'ambush' && isWeapon) { statRemove(g, p, [0, 0, 0, 0, 0, 0, 6, 0], false, fx); fired = true; }
    if (t === 'spynet' && (c[1] + c[3] + c[5]) >= 10) { o.crystal += 8; o.spyNext = true; fired = true; }
    if (t === 'militia' && hits) { o.recruit += 1; fired = true; }
    if (t === 'irongate' && op[7] > 0) { op[7] = 0; fired = true; }
    if (t === 'mirage' && isArrow && hits) { statRemove(g, p, [0, 0, 0, 0, 0, 0, op[6] + op[7], 0], false, fx); op[6] = 0; op[7] = 0; fired = true; }
    if (t === 'landmine' && isMelee) { statRemove(g, p, [0, 0, 0, 0, 0, 0, 10, 0], false, fx); fired = true; }
    if (fired) { fx.push('trap:' + t); o.trap = null; }
  }
  if (sp === 'spy' || sp === 'sabotage') {
    if (id >= 50) statRemove(g, p, c, false, fx); // las de raza sí pagan; las originales no (como en el original)
    g.pending = { type: sp, seat };
    if (RAPID.has(id) && (g.rapidUsed || 0) < 2) { g.rapidUsed = (g.rapidUsed || 0) + 1; g.rapidPending = true; fx.push('rapid'); }
    return { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])] };
  }
  if (sp === 'thief') { const cap = p.race === 'drow' ? 12 : 8; for (const k of ['brick', 'weapon', 'crystal']) { const t = Math.min(cap, o[k]); p[k] += t; o[k] -= t; } }
  if (sp === 'block') o.statsType = 4;
  if (sp === 'allWeapon') p.statsType = 2;
  if (sp === 'allCrystal') p.statsType = 3;
  if (sp === 'allBrick') p.statsType = 1;
  if (sp === 'shield') p.noDamage = true;
  if (c[8]) p.favor = Math.max(0, (p.favor || 0) - c[8]);
  const w0 = p.weapon;
  statRemove(g, p, c, id === 42, fx);
  if (cancelled) { fx.push('cancelled'); noteDamage(g, o); devClamp(g); return { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])] }; }
  statAdd(p, s);
  statRemove(g, o, op, false, fx);
  noteDamage(g, o);
  if (sp === 'double') p.x2 = true; // el próximo ataque, no este
  // efectos especiales de las cartas de raza
  if (special) {
    const k = special.k;
    if (k === 'edicto') { const ca = Math.floor((p.castle + o.castle) / 2), wa = Math.floor((p.wall + o.wall) / 2); p.castle = o.castle = Math.max(1, ca); p.wall = o.wall = wa; fx.push('edicto'); }
    if (k === 'wallToCastle') { p.castle += p.wall; p.wall = 0; fx.push('wallToCastle'); }
    if (k === 'cycle2') { const costly = p.hand.map((cid, j) => [j, cid, CARDS[cid][0].reduce((x, y) => x + y, 0)]).filter(([, cid]) => !playable(p, cid)).sort((x, y) => y[2] - x[2]).slice(0, 2); for (const [j, cid] of costly) { p.used.push(cid); p.hand[j] = draw(g, p); } fx.push('cycle'); }
    if (k === 'doubleCrystal') p.statsType = 5;
    if (k === 'extraTurn') { g.extraTurn = 2; fx.push('extraTurn'); }
    if (k === 'horde') { const dmg = w0 + 3 * p.recruit + (p.race === 'orco' ? 2 : 0); p.weapon = 0; statRemove(g, o, [0, 0, 0, 0, 0, 0, dmg, 0], false, fx); fx.push('horde'); }
    if (k === 'trap') { p.trap = special.t; fx.push('trapSet'); }
    if (k === 'effect') { const tgt = special.onOpp ? o : p; tgt.effects.push({ e: special.e, turns: special.turns + (special.e === 'drums' || special.e === 'siegelock' ? 1 : 0), from: seat }); fx.push('effectSet'); }
    if (k === 'usurp') { const take = Math.min(2, o.kingCharge || 0); o.kingCharge -= take; p.kingCharge += take; fx.push('kingDrain'); }
    if (k === 'kingNow') { if (p.race && KINGS[p.race]) { p.kingCharge = 0; const ka = kingAct(g, p); fx.push('kingNow'); if (ka.fx) fx.push(...ka.fx); } }
    if (k === 'kingDouble') { p.kingDouble = true; fx.push('kingDouble'); }
    if (k === 'luto') { o.luto = true; fx.push('luto'); if (o.kingGuard) { o.kingGuard = false; fx.push('kingGuarded'); } else { o.kingStun = Math.max(o.kingStun, 1); fx.push('kingStun'); } }
    if (k === 'stunKing' || k === 'drainKing') {
      if (o.kingGuard) { o.kingGuard = false; fx.push('kingGuarded'); }
      else { if (k === 'stunKing') o.kingStun = Math.max(o.kingStun, special.turns); if (special.drain) o.kingCharge = Math.max(0, o.kingCharge - special.drain); if (special.all) o.kingCharge = 0; fx.push(k === 'stunKing' ? 'kingStun' : 'kingDrain'); }
    }
    if (k === 'guardKing') { p.kingGuard = true; fx.push('kingGuard'); }
    if (k === 'wakeKing') { p.kingStun = 0; p.kingCharge += special.charge || 0; fx.push('kingWake'); }
    if (k === 'chargeKing') { p.kingCharge += special.charge || 0; fx.push('kingCharge'); }
    if (k === 'coin') {
      const win = g._rnd() < (special.p ?? 0.5), r = win ? special.heads : special.tails; fx.push(win ? 'coinHeads' : 'coinTails');
      if (r) { if (r.self) statAdd(p, r.self); if (r.opp) statRemove(g, o, r.opp, false, fx); if (r.selfCost) statRemove(g, p, r.selfCost, true, fx); if (r.selfDmg) statRemove(g, p, r.selfDmg, false, fx); }
    }
  }
  if (p.castle <= 0) p.castle = 0;
  if (RAPID.has(id) && (g.rapidUsed || 0) < 2) { g.rapidUsed = (g.rapidUsed || 0) + 1; g.rapidPending = true; fx.push('rapid'); }
  devClamp(g);
  return { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])] };
}

// Poder del rey según la raza
function kingAct(g, p) {
  const o = other(g, p), fx = [], before = [stats(g.players[0]), stats(g.players[1])];
  switch (p.race) {
    case 'humano': p.brick += 5; p.weapon += 5; p.crystal += 5; break;
    case 'enano': p.wall += 12; p.castle += 2; break;
    case 'elfo': p.crystal += 3; if (p.hand.length < handCap(p)) { p.hand.push(draw(g, p)); fx.push('draw'); } break;
    case 'drow': for (const k of ['brick', 'weapon', 'crystal']) o[k] = Math.max(0, o[k] - 6); break;
    case 'gnomo': { // el Inventor: la peor carta de la mano se cambia por una máquina gnoma, a mitad de costo este turno
      let worst = 0, wv = Infinity;
      p.hand.forEach((cid, j) => { const cc = CARDS[cid][0], tot = cc[1] + cc[3] + cc[5] + (cc[8] || 0) * 2; const v = (playable(p, cid) ? 100 : 0) + (playable(p, cid) ? tot : -tot); if (v < wv) { wv = v; worst = j; } });
      const nid = GNOME_MACHINES[Math.floor(g._rnd() * GNOME_MACHINES.length)];
      p.used.push(p.hand[worst]); p.hand[worst] = nid; p.halfId = nid; fx.push('invent:' + nid + ':' + worst); break; }
    case 'orco': statRemove(g, o, [0, 0, 0, 0, 0, 0, 13, 0], false, fx); break;
  }
  if (p.castle <= 0) p.castle = 0;
  return { race: p.race, fx, before, after: [stats(g.players[0]), stats(g.players[1])] };
}
// Modo desarrollador: recursos fijos en 99, la partida no termina, mano editable, razas y pasivas cambiables
export function devClamp(g) { if (g.dev?.infinite) for (const p of g.players) { p.brick = p.weapon = p.crystal = 99; p.favor = FAVOR_MAX; } }
export function devSetCard(g, seat, i, id) { if (!g.dev || !CARDS[id] || i < 0 || i >= g.players[seat].hand.length) return null; g.players[seat].hand[i] = id; return { type: 'devCard', seat, index: i, card: id }; }
export function devSetRace(g, seat, race, passives = true) { if (!g.dev) return null; const p = g.players[seat]; p.devRace = race || null; p.race = passives ? p.devRace : null; return { type: 'devRace', seat, race }; }
export function devPassives(g, on) { if (!g.dev) return; for (const p of g.players) p.race = on ? (p.devRace ?? p.race) : null; g.dev.passives = on; }
// Tope de mano: la base es HAND (5); se puede pasar con cartas extra hasta 6, los elfos hasta 8
export const handCap = (p) => (p.race === 'elfo' ? 8 : 6);
// Cambiar carta: todos pueden cambiar 1 carta por turno sin perder el turno; los elfos, 2
export const cycleMax = (p) => (p.race === 'elfo' ? 2 : 1);
export const cyclesLeft = (g) => Math.max(0, cycleMax(g.players[g.turn]) - (g.cycles || 0));
export function cycle(g, i) {
  if (g.winner != null || g.pending || !cyclesLeft(g)) return null;
  const p = g.players[g.turn]; if (i < 0 || i >= p.hand.length) return null;
  const card = p.hand[i]; p.used.push(card); p.hand[i] = draw(g, p); g.cycles = (g.cycles || 0) + 1; g.cycled = true;
  return { type: 'cycle', seat: g.turn, card, left: cyclesLeft(g) };
}
export function aiMaybeCycle(g) {
  if (g.pending || g.winner != null) return null; const p = g.players[g.turn]; let ev = null, n = 0;
  while (cyclesLeft(g)) {
    let worst = -1, wc = -1;
    p.hand.forEach((id, i) => { if (!playable(p, id)) { const cc = CARDS[id][0].reduce((x, y) => x + y, 0) + (CARDS[id][0][8] || 0) * 2; if (cc > wc) { wc = cc; worst = i; } } });
    if (worst < 0) break; ev = cycle(g, worst); n++;
  }
  return ev ? { ...ev, count: n } : null;
}

// Cortar las jugadas extra del Reloj de arena antes de tiempo
export function passExtra(g) {
  if (g.winner != null || g.pending || !g.inExtra) return null;
  g.extraTurn = 0; return { type: 'pass', seat: g.turn };
}
export function discard(g, idxs) {
  if (g.winner != null || g.pending) return null;
  const list = [...new Set(idxs)].filter((i) => i >= 0 && i < g.players[g.turn].hand.length).slice(0, 3);
  if (!list.length) return null;
  const p = g.players[g.turn], cards = [];
  for (const i of list) { cards.push(p.hand[i]); p.used.push(p.hand[i]); p.hand[i] = draw(g, p); }
  return { type: 'discard', seat: g.turn, cards };
}

// Resuelve el Sabotaje: descarta la carta k del rival (como en el original, no vuelve al mazo).
export function sabotage(g, k) {
  if (g.pending?.type !== 'sabotage') return null;
  const o = g.players[1 - g.pending.seat]; if (k < 0 || k >= o.hand.length) k = 0;
  const card = o.hand[k]; o.hand[k] = draw(g, o);
  const ev = { type: 'sabotage', seat: g.pending.seat, card, index: k };
  g.pending = null; return ev;
}
export function spyDone(g) { if (g.pending?.type !== 'spy') return null; g.pending = null; return { type: 'spyDone' }; }

// Cierra el turno: chequea victoria (como el original, primero el jugador 1) y aplica producción del siguiente.
export function endTurn(g) {
  if (!g.dev?.noWin) for (const [i, p] of g.players.entries()) {
    if (p.castle >= 100) { g.winner = i; return { type: 'win', winner: i, reason: 'castle100' }; }
    if (p.castle <= 0) { p.castle = 0; g.winner = 1 - i; return { type: 'win', winner: 1 - i, reason: 'castle0' }; }
  }
  if (g.rapidPending) { g.rapidPending = false; g.inExtra = true; g.rapidMode = true; const p = g.players[g.turn]; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, rapid: true, left: 1 }; }
  if (g.extraTurn > 0) { g.extraTurn--; g.inExtra = true; g.rapidMode = false; g.cycled = false; g.cycles = 0; const p = g.players[g.turn]; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, left: g.extraTurn + 1 }; }
  g.inExtra = false; g.rapidMode = false; g.rapidUsed = 0; g.players[g.turn].halfId = null;
  g.turn = 1 - g.turn; g.turnNo++; g.cycled = false; g.cycles = 0;
  const p = g.players[g.turn], before = stats(p), all = p.builder + p.recruit + p.mage, both = () => [stats(g.players[0]), stats(g.players[1])], S0 = both();
  switch (p.statsType) {
    case 0: p.brick += p.builder; p.weapon += p.recruit; p.crystal += p.mage; break;
    case 1: p.brick += all; break;
    case 2: p.weapon += all; break;
    case 3: p.crystal += all; break;
    case 5: p.brick += p.builder; p.weapon += p.recruit; p.crystal += p.mage * 2; break;
  }
  if (p.race) p.favor = Math.min(FAVOR_MAX, (p.favor || 0) + 1);
  p.lastDamage = p.dmgRound; p.dmgRound = 0; const S1 = both();
  // efectos duraderos: actúan al inicio del turno de su dueño (o del afectado, si están sobre él)
  const effectsLog = [], o3 = other(g, p);
  for (const e of p.effects) {
    e.turns--;
    switch (e.e) {
      case 'rain': statRemove(g, o3, [0, 0, 0, 0, 0, 0, 5, 0], false, []); effectsLog.push('rain'); break;
      case 'quarry': p.brick += 4; effectsLog.push('quarry'); break;
      case 'livingwall': p.wall += 5; effectsLog.push('livingwall'); break;
      case 'tithe': p.kingCharge = (p.kingCharge || 0) + 1; effectsLog.push('tithe'); break;
      case 'edict': if (e.turns % 2 === 0) { p.builder += 1; effectsLog.push('edict'); } break;
      case 'mines': p.brick += 3; p.wall += 1; effectsLog.push('mines'); break;
      case 'whispers': o3.crystal = Math.max(0, o3.crystal - 3); p.crystal += 1; effectsLog.push('whispers'); break;
      case 'nightshop': p.weapon += 3; effectsLog.push('nightshop'); break;
      case 'siegelock': effectsLog.push('siegelock'); break;
      case 'drums': effectsLog.push('drums'); break;
    }
  }
  p.effects = p.effects.filter((e) => e.turns > 0); const S2 = both();
  // el rey: si está desmayado se recupera un turno; si no, carga; al completar el período, actúa
  let king = null;
  if (p.race && KINGS[p.race]) {
    if (p.kingStun > 0) p.kingStun--;
    else { if (p.kingCharge >= KINGS[p.race].period) { p.kingCharge = 0; king = kingAct(g, p); if (p.kingDouble) { p.kingDouble = false; const k2 = kingAct(g, p); king.after = k2.after; king.fx = king.fx.concat(k2.fx, ['double']); } } else { p.kingCharge++; if (p.kingCharge >= KINGS[p.race].period) { p.kingCharge = 0; king = kingAct(g, p); if (p.kingDouble) { p.kingDouble = false; const k2 = kingAct(g, p); king.after = k2.after; king.fx = king.fx.concat(k2.fx, ['double']); } } } }
  }
  if (p.spyNext) { p.spyNext = false; g.pending = { type: 'spy', seat: g.turn }; }
  const blocked = p.statsType === 4;
  devClamp(g);
  if (!blocked && p.race === 'humano') { const k = ['brick', 'weapon', 'crystal'].sort((x, y) => p[x] - p[y])[0]; if (p[k] < 6) p[k] += 1; }
  p.statsType = 0; devClamp(g);
  const o2 = other(g, p); if (o2.castle <= 0 || p.castle >= 100 || o2.castle >= 100 || p.castle <= 0) { if (!g.dev?.noWin) { if (o2.castle <= 0 || p.castle >= 100) g.winner = g.turn; else g.winner = 1 - g.turn; } }
  return { type: 'turn', seat: g.turn, before, after: stats(p), blocked, king, effects: effectsLog, steps: [S0, S1, S2, both()] };
}

// IA del original (con sus rarezas incluidas).
function aiScoreUse(p, id) {
  const [c, s, o] = CARDS[id]; let sc = 0;
  if (s[0] > 0 && p.builder < 5) sc = 15;
  if (s[2] > 0 && p.recruit < 5) sc = 15;
  if (s[4] > 0 && p.mage < 5) sc = 15;
  if (id === 20 && p.noDamage) sc = -30;
  if (id === 21) sc = -30;
  if (s[7] > 0 && p.castle >= 80) sc = s[7] * 2;
  if (o[7] + o[6] > 10) sc = -30;
  return sc + c[1] + c[3] + c[5];
}
export function aiChoose(g) {
  const p = g.players[g.turn];
  const usable = []; p.hand.forEach((id, i) => { if (playable(p, id)) usable.push(i); });
  if (usable.length) {
    let best = usable[0], bs = aiScoreUse(p, p.hand[best]);
    for (const i of usable) { const s = aiScoreUse(p, p.hand[i]); if (s > bs) { bs = s; best = i; } }
    return { type: 'play', index: best };
  }
  const sc = p.hand.map((id) => {
    const [c, s] = CARDS[id];
    if (s[0] > 0 || s[2] > 0 || s[4] > 0) return 0;
    const a = (c[1] - p.brick) / p.builder, b = (c[3] - p.weapon) / p.recruit, d = (c[5] - p.crystal) / p.mage;
    let m = a >= 1 ? a : 1; m = b >= m ? b : m; m = d >= m ? d : m; return m;
  });
  const NH = p.hand.length; for (let i = 0; i < NH; i++) for (let j = i; j < NH; j++) if (i !== j && p.hand[i] === p.hand[j]) sc[i] += 25;
  const pick = [];
  for (let i = 0; i < NH; i++) { if (sc[i] > 3 * (pick.length + 1)) pick.push(i); if (pick.length === 3) break; }
  if (!pick.length) { let b = 0; for (let i = 1; i < NH; i++) if (sc[i] > sc[b]) b = i; pick.push(b); }
  return { type: 'discard', indexes: pick };
}
export const aiSabotagePick = (rnd = Math.random) => Math.floor(rnd() * HAND);

// Vista de la partida para un asiento: oculta la mano rival salvo que un Espía o Sabotaje propio la revele.
export function viewFor(g, seat) {
  const pub = (p) => ({ race: p.race || null, builder: p.builder, brick: p.brick, recruit: p.recruit, weapon: p.weapon, mage: p.mage, crystal: p.crystal, wall: p.wall, castle: p.castle, noDamage: p.noDamage, x2: p.x2, statsType: p.statsType, deckCount: p.deck.length, usedCount: p.used.length, kingCharge: p.kingCharge, kingStun: p.kingStun, kingGuard: p.kingGuard, favor: p.favor || 0, trap: p.trap || null, effects: (p.effects || []).map((e) => ({ e: e.e, turns: e.turns, from: e.from })), lastDamage: p.lastDamage || 0, kingDouble: !!p.kingDouble, halfId: p.halfId || null, luto: !!p.luto, kingPeriod: p.race && KINGS[p.race] ? KINGS[p.race].period : 0 });
  const me = g.players[seat], op = g.players[1 - seat];
  const reveal = g.pending && g.pending.seat === seat;
  return { seat, turn: g.turn, winner: g.winner, pending: g.pending, turnNo: g.turnNo, cycled: g.cycled, cyclesLeft: g.turn === seat ? cyclesLeft(g) : 0, inExtra: !!g.inExtra, extraLeft: g.inExtra ? g.extraTurn + 1 : 0, rapid: !!g.rapidMode, races: [g.players[0].race, g.players[1].race], me: { ...pub(me), hand: me.hand.slice() }, op: { ...pub(op), hand: reveal ? op.hand.slice() : null } };
}

/* ======================= IA POR NIVELES ======================= */
// Fácil = IA original (aiChoose). Normal = evalúa cada jugada. Difícil = además anticipa la mejor respuesta del rival
// muestreando manos posibles con las cartas que le quedan (no espía su mano real).

function cloneGame(g) {
  const cp = (p) => ({ ...p, deck: p.deck.slice(), used: p.used.slice(), hand: p.hand.slice(), effects: (p.effects || []).map((e) => ({ ...e })) });
  return { ...g, players: [cp(g.players[0]), cp(g.players[1])], pending: g.pending ? { ...g.pending } : null };
}
const clampV = (v, cap, slope) => (v <= cap ? v : cap + (v - cap) * slope);

// Valor de la posición desde el punto de vista de `seat`.
export const W = { castle: 0.8, castleHi: 7.9, castleLo: 3.9, wall: 1.63, wallCap: 29, unit: 35, unitCap: 15.8, res: 0.8, resCap: 22.6, shield: 13, x2: 20, threat: 1.52, threatK: 0.46, oppW: 2.33 }; // ajustados por búsqueda automática
export const W2 = { castle: 0.92, castleHi: 21.8, castleLo: 3.4, wall: 2.4, wallCap: 29, unit: 46.5, unitCap: 20.2, res: 0.8, resCap: 25.8, shield: 9.2, x2: 20.6, threat: 1.38, threatK: 0.7, oppW: 1.64 }; // pesos del nivel Difícil
export function evaluate(g, seat, Wt = W) {
  const W = Wt;
  if (g.winner != null) return g.winner === seat ? 1e5 : -1e5;
  let extraBonus = 0;
  if (g.turn === seat && g.inExtra) { const p = g.players[seat], n = p.hand.filter((id) => playable(p, id)).length; extraBonus = Math.min(n, g.extraTurn + 1) * 9; }
  const me = g.players[seat], op = g.players[1 - seat];
  const side = (p, o) => {
    let v = 0;
    v += p.castle * W.castle + (p.castle >= 70 ? (p.castle - 70) * W.castleHi : 0) + (p.castle <= 15 ? -(15 - p.castle) * W.castleLo : 0);
    v += clampV(p.wall, W.wallCap, 0.35) * W.wall;
    for (const u of ['builder', 'recruit', 'mage']) v += clampV(p[u], W.unitCap, 0.5) * W.unit;
    for (const r of ['brick', 'weapon', 'crystal']) v += clampV(p[r], W.resCap, 0.3) * W.res;
    if (p.noDamage) v += W.shield;
    if (p.x2) v += W.x2;
    if (p.statsType >= 1 && p.statsType <= 3) v += 3;
    if (p.race && KINGS[p.race]) {
      const per = KINGS[p.race].period, ch = p.kingCharge || 0, near = ch / per; // cuanto más cerca de actuar, más vale el rey (y más duele que lo desmayen)
      v += ch * (2 + near * 4) - (p.kingStun || 0) * (3 + near * 9) + (p.kingGuard ? 2 + near * 4 : 0) + (p.kingDouble ? 6 : 0);
    }
    // trampas: valen más cuando el rival tiene con qué caer en ellas
    const TV = { moat: 3 + Math.min(8, o.weapon / 3), counterspell: 3 + Math.min(8, o.crystal / 3), ambush: 3 + Math.min(6, o.weapon / 4), spynet: 4, militia: 4, irongate: 4, mirage: 3 + Math.min(6, o.weapon / 4), landmine: 3 + Math.min(8, o.weapon / 3) };
    v += (p.favor || 0) * 1.2 + (p.trap ? (TV[p.trap] || 6) : 0) + (p.effects || []).reduce((a, e) => a + e.turns * 3, 0) + (p.luto && o.kingStun ? 2 : 0);
    const pot = p.weapon * 0.8 + p.crystal * 0.9, def = o.wall + o.castle;
    if (pot > def * W.threatK) v += (pot - def * W.threatK) * W.threat;
    return v;
  };
  return side(me, op) - side(op, me) * W.oppW + extraBonus;
}

// Aplica una acción sobre una copia y cierra el turno (incluye la producción del rival).
function simulate(g, act, rnd) { // eslint-disable-line
  const c = cloneGame(g); c._rnd = rnd;
  let bonus = 0;
  if (act.type === 'play') {
    const ev = play(c, act.index); if (!ev) return null;
    if (c.pending?.type === 'sabotage') { sabotage(c, Math.floor(rnd() * c.players[1 - c.pending.seat].hand.length)); bonus += 4; }
    if (c.pending?.type === 'spy') { spyDone(c); bonus += 1; }
  } else if (!discard(c, act.indexes)) return null;
  endTurn(c);
  return { g: c, bonus };
}

function candidateMoves(g) {
  const p = g.players[g.turn], moves = [];
  p.hand.forEach((id, i) => { if (playable(p, id)) moves.push({ type: 'play', index: i }); });
  // descartes candidatos: la carta más difícil de pagar, y los duplicados
  const cost = (id) => { const [c] = CARDS[id]; return Math.max((c[1] - p.brick) / p.builder, (c[3] - p.weapon) / p.recruit, (c[5] - p.crystal) / p.mage, 0); };
  const order = p.hand.map((id, i) => [i, cost(id) + (p.hand.indexOf(id) !== i ? 3 : 0)]).sort((a, b) => b[1] - a[1]);
  moves.push({ type: 'discard', indexes: [order[0][0]] });
  if (!moves.some((m) => m.type === 'play')) moves.push({ type: 'discard', indexes: order.slice(0, 3).filter((o) => o[1] > 2).map((o) => o[0]).concat(order[0][0]).slice(0, 3) });
  return moves;
}

function bestReply(g, seat, rnd) {
  // el rival (a quien le toca en g) elige su mejor jugada 1-ply
  let best = -Infinity;
  for (const m of candidateMoves(g)) {
    const r = simulate(g, m, rnd); if (!r) continue;
    const v = evaluate(r.g, g.turn) + r.bonus; if (v > best) best = v;
  }
  return best;
}

export const HARD = { mix: 0.7, K: 12, v2: true, top: 4, chain: true, mix2: 0.5, K2: 16, mc: true, R: 20, D: 3, T: 80, pol: 'n' }; // Difícil: Monte Carlo corto (mi jugada, respuesta del rival, mi siguiente) sobre manos rivales posibles
// Difícil v2: encadena jugadas extra (Rápidas / Reloj), y anticipa la respuesta del rival solo en las mejores jugadas
function hardLeaves(g, seat, rnd, depth, first, out) {
  for (const m of candidateMoves(g)) {
    const r = simulate(g, m, rnd); if (!r) continue;
    if (HARD.chain && depth < 3 && r.g.winner == null && r.g.turn === seat && !r.g.pending) {
      const sub = []; hardLeaves(r.g, seat, rnd, depth + 1, first ?? m, sub);
      if (sub.length) { for (const x of sub) { x.bonus += r.bonus; out.push(x); } continue; }
    }
    out.push({ first: first ?? m, g: r.g, bonus: r.bonus, v: evaluate(r.g, seat) + r.bonus });
  }
}
function lookahead(gs, seat, rnd) {
  const opSeat = 1 - seat, op = gs.players[opSeat], pool = op.deck.concat(op.hand); let sum = 0;
  for (let k = 0; k < HARD.K2; k++) {
    const s = cloneGame(gs); s._rnd = rnd; const so = s.players[opSeat];
    const pl = pool.slice(); shuffle(pl, rnd); const nh = so.hand.length; so.hand = pl.slice(0, nh); so.deck = pl.slice(nh);
    let bo = -Infinity, mine = 0;
    for (const om of candidateMoves(s)) { const rr = simulate(s, om, rnd); if (!rr) continue; const ov = evaluate(rr.g, opSeat) + rr.bonus; if (ov > bo) { bo = ov; mine = evaluate(rr.g, seat); } }
    sum += bo === -Infinity ? evaluate(s, seat) : mine;
  }
  return sum / HARD.K2;
}
function rollPolicy(g, rnd) {
  if (HARD.pol === 'n') { // greedy 1-ply con la evaluación normal
    let bm = null, bv = -Infinity; for (const m of candidateMoves(g)) { const r = simulate(g, m, rnd); if (!r) continue; const v = evaluate(r.g, g.turn) + r.bonus; if (v > bv) { bv = v; bm = m; } } return bm || aiChoose(g);
  }
  return aiChoose(g);
}
function aiMC(g, rnd) {
  const seat = g.turn, moves = candidateMoves(g), opSeat = 1 - seat; if (moves.length === 1) return moves[0];
  const score = moves.map(() => 0);
  for (let k = 0; k < HARD.R; k++) {
    const base = cloneGame(g); base._rnd = rnd; const o = base.players[opSeat], me = base.players[seat];
    const pl = o.deck.concat(o.hand); shuffle(pl, rnd); const nh = o.hand.length; o.hand = pl.slice(0, nh); o.deck = pl.slice(nh); shuffle(me.deck, rnd);
    moves.forEach((m, i) => {
      const c = cloneGame(base); c._rnd = rnd; 
      if (m.type === 'play') { if (!play(c, m.index)) { score[i] -= 1e9; return; } } else if (!discard(c, m.indexes)) { score[i] -= 1e9; return; }
      for (let t = 0; t < HARD.D && c.winner == null; t++) {
        if (c.pending?.type === 'sabotage') sabotage(c, aiSabotageSmart(c)); if (c.pending?.type === 'spy') spyDone(c);
        endTurn(c); if (c.winner != null) break;
        aiMaybeCycle(c); const a = rollPolicy(c, rnd); a.type === 'play' ? (play(c, a.index) || discard(c, [a.index])) : discard(c, a.indexes);
      }
      if (c.winner == null && !c.pending) endTurn(c);
      score[i] += c.winner != null ? (c.winner === seat ? 1 : 0) : 1 / (1 + Math.exp(-(evaluate(c, seat)) / HARD.T));
    });
  }
  let b = 0; score.forEach((v, i) => { if (v > score[b]) b = i; }); return moves[b];
}
function aiHard(g, rnd) {
  if (HARD.mc) return aiMC(g, rnd);
  const seat = g.turn, leaves = []; hardLeaves(g, seat, rnd, 0, null, leaves);
  if (!leaves.length) return null;
  const best = new Map(); // mejor hoja por primera jugada
  for (const l of leaves) { const k = JSON.stringify(l.first); if (!best.has(k) || best.get(k).v < l.v) best.set(k, l); }
  const list = [...best.values()].sort((a, b) => b.v - a.v);
  if (list[0].g.winner === seat) return list[0].first;
  for (const l of list.slice(0, HARD.top)) if (l.g.winner == null) l.v = l.v * HARD.mix2 + lookahead(l.g, seat, rnd) * (1 - HARD.mix2);
  list.sort((a, b) => b.v - a.v); return list[0].first;
}
export function aiChooseLevel(g, level = 'normal', rnd = Math.random) {
  if (level === 'facil') return aiChoose(g);
  if (level === 'dificil' && HARD.v2) { const m = aiHard(g, rnd); if (m) return m; }
  const seat = g.turn, moves = candidateMoves(g);
  const scored = [];
  for (const m of moves) {
    const r = simulate(g, m, rnd); if (!r) continue;
    const Wt = W; // (W2 era de la versión vieja; con razas y reyes los pesos del Normal rinden mejor)
    let v = evaluate(r.g, seat, Wt) + r.bonus;
    if (level === 'dificil' && HARD.K > 0 && r.g.winner == null) {
      // anticipar: muestrear manos posibles del rival con sus cartas desconocidas
      const opSeat = 1 - seat, op = r.g.players[opSeat];
      const pool = op.deck.concat(op.hand);
      const K = HARD.K; let sum = 0;
      for (let k = 0; k < K; k++) {
        const s = cloneGame(r.g); s._rnd = rnd; const so = s.players[opSeat];
        const pl = pool.slice(); shuffle(pl, rnd); const nh = so.hand.length; so.hand = pl.slice(0, nh); so.deck = pl.slice(nh);
        const replyVal = bestReply(s, opSeat, rnd); // valor para el rival
        // reconstruimos el valor para nosotros con la jugada que más le conviene al rival
        let worst = Infinity;
        for (const om of candidateMoves(s)) {
          const rr = simulate(s, om, rnd); if (!rr) continue;
          const ov = evaluate(rr.g, opSeat) + rr.bonus;
          if (ov >= replyVal - 1e-9) { worst = Math.min(worst, evaluate(rr.g, seat, Wt)); }
        }
        sum += worst === Infinity ? v : worst;
      }
      v = v * HARD.mix + (sum / K) * (1 - HARD.mix);
    }
    scored.push([m, v]);
  }
  if (!scored.length) return aiChoose(g);
  scored.sort((a, b) => b[1] - a[1]);
  // Normal: a veces elige entre las mejores parecidas para no ser robótico
  if (level === 'normal') { const top = scored.filter((s) => s[1] >= scored[0][1] - 4); return top[Math.floor(rnd() * top.length)][0]; }
  return scored[0][0];
}

// Sabotaje inteligente (Normal/Difícil): con la mano rival a la vista, descarta la carta más cara.
export function aiSabotageSmart(g) {
  const op = g.players[1 - g.pending.seat];
  let best = 0, bv = -1;
  op.hand.forEach((id, i) => { const [c, s, o] = CARDS[id]; const v = c[1] + c[3] + c[5] + (o[6] + o[7]) * 0.5 + (s[0] + s[2] + s[4]) * 8; if (v > bv) { bv = v; best = i; } });
  return best;
}
