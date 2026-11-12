// Motor del Asedio. Sin dependencias de DOM ni de red: lo usan el servidor y el cliente.
import { hitOf } from './hits.js';
import { arrowDmg } from './campaign-cards.js';
import { LEGENDARY, CARDS, SPECIAL, FX, DEFAULT_DECK, DEFAULT_RES, HAND, KINGS, FAVOR_MAX, ARROW_IDS, MELEE_IDS, RAPID, GNOME_MACHINES, NAMES, MYTHIC, RARE, RARE_RACE, padDeck, raceOf } from './cards.js';

const KEYS = ['builder', 'brick', 'recruit', 'weapon', 'mage', 'crystal', 'wall', 'castle'];
export const stats = (p) => KEYS.map((k) => p[k]);

function shuffle(a, rnd) { let n = a.length; if (!n) return; while (--n) { const j = Math.floor(rnd() * (n + 1)); [a[n], a[j]] = [a[j], a[n]]; } }

function makePlayer(counts, res, rnd, handSize = HAND) {
  const p = { ...res, noDamage: false, x2: false, statsType: 0, deck: [], used: [], hand: [], handSize, sleeve: null, acted: false };
  counts.forEach((n, i) => { for (let k = 0; k < n; k++) p.deck.push(i + 1); }); // el mazo puede tener cualquier largo (campaña: 15-40; PvP: 60)
  shuffle(p.deck, rnd);
  return p;
}
// Tamaño de mano del jugador (PvP: HAND = 5; campaña: 3 a 6 por asiento)
export const handSize = (p) => (p.handSize ?? HAND) + (p.sealPact ? p.hand.filter((h) => isCurse(h) || isState(h)).length : 0); // Sello del pacto (drow): las maldiciones no ocupan lugar
// Período del rey (campaña: una regla de jefe puede acortarlo)
const hasKing = (p) => !!(p.race && KINGS[p.race] && !p.noKing);
export const kingPeriod = (p) => p.kingPeriod ?? (p.race && KINGS[p.race] ? KINGS[p.race].period : 0);

// PvP: newGame({ decks, races, starter, rnd }). Campaña: además `seats` (config por asiento) y `campaign` (modo).
//  seats[i] = { deck, hand, res: { castle, wall, brick, weapon, crystal, builder, recruit, mage }, race, king (false = sin rey), hooks, rules, capCastle, capWall }
//  campaign = { noWin100: true (no se gana llegando a 100) }
//  sleeves = [id0, id1]: carta de la manga de cada asiento, elegida antes de repartir (CPU, simulaciones).
//  setup = true: la partida arranca en la fase 'sleeve' (manos vacías); cada jugador elige su As con chooseSleeve y, cuando eligieron
//          los dos, el motor reparte (evento 'deal'). Es el flujo de la partida real (cliente y online).
export function newGame({ starter = 0, rnd = Math.random, decks = [DEFAULT_DECK, DEFAULT_DECK], res = DEFAULT_RES, races = [null, null], dev = false, seats = null, campaign = null, sleeves = null, setup = false } = {}) {
  const sc = (i) => seats?.[i] || {};
  const mkp = (i) => makePlayer(sc(i).deck || decks[i], { ...res, ...(sc(i).res || {}) }, rnd, sc(i).hand ?? HAND);
  const g = { players: [mkp(0), mkp(1)], turn: starter, pending: null, winner: null, turnNo: 1, cycled: false, extraTurn: false, dev: dev ? { infinite: true, noWin: true } : null };
  g.players[0].race = (seats ? sc(0).race : races[0]) || null; g.players[1].race = (seats ? sc(1).race : races[1]) || null;
  for (const p of g.players) { p.kingCharge = 0; p.kingStun = 0; p.kingGuard = false; p.favor = 0; p.trap = null; p.trapSeen = false; p.effects = []; p.lastDamage = 0; p.dmgRound = 0; p.kingDouble = false; p.luto = false; p.stunTurn = false; } if (dev) { g.players[0].devRace = races[0] || null; g.players[1].devRace = races[1] || null; }
  if (seats || campaign) {
    g.campaign = { noWin100: !!campaign?.noWin100, baseProd: campaign?.baseProd || 0 };
    g.hooks = [sc(0).hooks || null, sc(1).hooks || null]; if (!g.hooks[0] && !g.hooks[1]) g.hooks = null;
    g.players.forEach((p, i) => { const c = sc(i); if (c.king === false) p.noKing = true; if (c.capCastle != null) p.capCastle = c.capCastle; if (c.capWall != null) p.capWall = c.capWall; if (c.kingPeriod) p.kingPeriod = c.kingPeriod; p.rs = {}; if (campaign) campSeat(p, c); });
    if (campaign) g.playsLeft = Math.floor(g.players[starter].plays || 1);
  }
  g._rnd = rnd;
  if (setup) { g.phase = 'sleeve'; g.players.forEach((p) => { p.sleeveDone = false; }); devClamp(g); return g; } // manos vacías hasta que los dos elijan su As
  if (sleeves) for (let i = 0; i < 2; i++) if (sleeves[i] != null) takeSleeve(g.players[i], sleeves[i]);
  dealHands(g);
  return g;
}
// Reparte las manos (de a una carta, alternando desde el que arranca) y arranca la pelea. Devuelve el evento para animar:
// { type: 'deal', order: [asiento, …] (una entrada por carta), redeal: [0, 0] (ya no se re-reparte; queda por compatibilidad) }
function dealHands(g) {
  const rnd = g._rnd, order = [], redeal = [0, 0], H = g.players.map(handSize);
  for (let i = 0; i < Math.max(H[0], H[1]); i++) for (const seat of [g.turn, 1 - g.turn]) if (i < H[seat]) { g.players[seat].hand.push(draw(g, g.players[seat], rnd)); order.push(seat); }
  for (const p of g.players) if (p.camp) campInnate(p); // campaña: las cartas "De mano" arrancan en la mano
  // mano inicial garantizada (se arma antes de mostrarla, sin re-repartir): si hay menos de 2 cartas jugables, las injugables más caras
  // vuelven al mazo y se cambian por jugables del mazo. Antes se re-repartía hasta 3 veces: saltaba en el 72 % de las manos y en el 39 %
  // quedaba mala igual. `redeal` queda siempre en 0 (se mantiene el campo por compatibilidad).
  g.players.forEach((p) => {
    const cost = (id) => CARDS[id][0].reduce((a, b) => a + b, 0);
    let ok = p.hand.filter((id) => playable(p, id)).length;
    if (ok >= 2) return;
    const bad = p.hand.map((id, i) => [i, id]).filter(([, id]) => !playable(p, id)).sort((x, y) => cost(y[1]) - cost(x[1]));
    for (const [i, id] of bad) {
      if (ok >= 2) break;
      const j = p.deck.findIndex((d) => playable(p, d)); if (j < 0) break;
      p.hand[i] = p.deck[j]; p.deck[j] = id; ok++;
    }
    shuffle(p.deck, rnd);
  });
  g.phase = 'play'; devClamp(g);
  const sfx = []; fire(g, 'onBattleStart', { fx: sfx }); g.startFx = sfx; // fx: 'eq:<id>' (equipo que actuó al empezar), 'rune:grabar:<tipo>'…
  return { type: 'deal', order, redeal, ...(sfx.length ? { fx: sfx } : {}) };
}
// saca una copia de `id` del mazo y la pone en la manga (antes de repartir)
function takeSleeve(p, id) { const k = p.deck.indexOf(id); if (k < 0) return false; p.deck.splice(k, 1); p.sleeve = id; return true; }
// Fase 'sleeve': el jugador elige su As (id de una carta de su mazo; null = sin manga). Se puede cambiar hasta que eligen los dos.
// Devuelve { type: 'sleeve', seat } y, si con esta elección ya eligieron los dos, además `deal` (el reparto, ver dealHands).
export function chooseSleeve(g, seat, id) {
  if (g.phase !== 'sleeve') return null; const p = g.players[seat]; if (!p) return null;
  if (id != null && (!CARDS[id] || stuck(id) || (!p.deck.includes(id) && p.sleeve !== id))) return null;
  if (p.sleeve != null) { p.deck.push(p.sleeve); p.sleeve = null; }
  if (id != null) takeSleeve(p, id);
  p.sleeveDone = true;
  const ev = { type: 'sleeve', seat };
  if (g.players.every((q) => q.sleeveDone)) { shuffle(g.players[0].deck, g._rnd); shuffle(g.players[1].deck, g._rnd); ev.deal = dealHands(g); }
  return ev;
}
// Fase 'sleeve': las cartas del mazo para elegir el As, una por tipo, con la mítica primero: [{ id, n }]
export function sleeveChoices(p) {
  const n = {}; for (const id of p.deck) if (!stuck(id)) n[id] = (n[id] || 0) + 1; if (p.sleeve != null) n[p.sleeve] = (n[p.sleeve] || 0) + 1;
  return Object.keys(n).map(Number).sort((a, b) => (MYTHIC.has(b) - MYTHIC.has(a)) || a - b).map((id) => ({ id, n: n[id] }));
}
// IA / timeout: elige el As para un asiento en la fase 'sleeve' (la mítica si la tiene; si no, su ataque más grande)
export function aiChooseSleeve(g, seat) { const p = g.players[seat], c = []; for (const id of p.deck) c[id - 1] = (c[id - 1] || 0) + 1; for (let i = 0; i < c.length; i++) c[i] = c[i] || 0; return chooseSleeve(g, seat, aiSleevePick(c)); }
// Hooks de campaña (equipo y reglas de jefe). g.hooks = [hooksAsiento0, hooksAsiento1]; cada uno es { onBattleStart, onTurnStart, onCardPlayed, onDamage, onKingAct }
// con firma (g, miAsiento, info). En PvP g.hooks es null y no pasa nada. Pueden empujar textos en info.fx para que la UI los muestre.
function fire(g, name, info) {
  if (!g.hooks) return;
  for (let i = 0; i < 2; i++) { const h = g.hooks[i]; if (h && typeof h[name] === 'function') h[name](g, i, info); }
}

function draw(g, p, rnd = g._rnd) {
  if (!p.deck.length) { p.deck = p.used.slice(); p.used = []; shuffle(p.deck, rnd); }
  const id = p.deck.pop();
  if (p.ladyPact && id != null && isCurse(id)) { p.wall += 3; const o = other(g, p); o.venom = (o.venom || 0) + 2; } // Señora de los pactos (drow)
  return id;
}
/* ---------- Manga ---------- */
// Al empezar, cada jugador aparta 1 carta de su mazo en la manga (secreta; el rival solo ve que hay una). Se juega desde ahí en cualquier
// turno propio pagando +2 de cada recurso que pida (Juan 26/10; antes 1/3 más). Pensada para la mítica (Ataque del rey), pero va cualquier carta.
export const SLEEVE_MULT = 4 / 3;
// Opciones de reglas para medir el paquete del informe 2 de los críticos (26/10). Los valores de acá son las reglas vigentes.
// Juan 26/10 (informe 2): descartar da +2 del recurso más bajo, el x2 no suma al rey, drow ×1,5, manga +2 fijo, Thorgrim +5, Gorrak 13
// Juan 27/10 (paquete "para llegar a 8"): descartar +3 del recurso de la carta, piso al robo, mítica sin el rey del turno y 1 unidad, manga +1, Sed de sangre solo al muro, Puerta la mitad
export const OPT = { discardGain: 3, cycles: 0, noX2King: true, drowMult: 1.5, prodFloor: 0, sleeveAdd: 1, thorgrim: 5, fizzBest: false, gorrak: 13, finalSiege: 0, siegeRamp: 0.5, cheapFrom: 35, cheapStep: 0.1, cheapMax: 0.5, pesteNoDrow: false, pesteNoUnits: false, woundedMin: 1, guardNoMythic: true, gateCap: 0, sleeveLegend: 1, discardPick: true, stealFloor: true, mythicNoKingTurn: true, mythicOneUnit: true, x2Wall: true, gateHalf: true, ash: 3 / 2, sleeveTier: true, thorgrimCap: 70 }; // Juan 27/10 (informe 4): herida produce 1, Guardia real no frena la mítica, legendarias +1 desde la manga
// (Sin fase de elección, para DEV/campaña) Elegir o cambiar la carta de la manga ya repartida: solo antes de la primera acción del jugador. Saca una copia del mazo (o de la mano, si todas están ahí).
export function setSleeve(g, seat, id) {
  if (g.phase === 'sleeve') return chooseSleeve(g, seat, id);
  const p = g.players[seat]; if (!p || p.acted || g.winner != null || !CARDS[id] || stuck(id)) return null;
  if (p.sleeve != null) { p.deck.push(p.sleeve); p.sleeve = null; shuffle(p.deck, g._rnd); }
  let k = p.deck.indexOf(id); if (k >= 0) p.deck.splice(k, 1);
  else { k = p.hand.indexOf(id); if (k < 0) return null; p.hand[k] = draw(g, p); }
  p.sleeve = id;
  return { type: 'sleeve', seat };
}
// IA: qué carta guardar en la manga (la mítica si está en el mazo; si no, el ataque más grande). counts = mazo como cantidades.
export function aiSleevePick(counts) {
  let best = null, bv = -1;
  counts.forEach((n, i) => { if (!n) return; const id = i + 1; if (!CARDS[id]) return; if (MYTHIC.has(id)) { best = id; bv = 1e9; return; } const [c, , o] = CARDS[id]; const v = (o[6] + o[7]) * 2 + c[1] + c[3] + c[5]; if (v > bv) { bv = v; best = id; } });
  return best;
}
// Cartas de campaña: maldiciones y estados no se juegan ni se descartan (ocupan la mano)
export const isCurse = (id) => FX[id]?.k === 'curse';
export const isState = (id) => FX[id]?.k === 'state';
const stuck = (id) => isCurse(id) || isState(id);
export const NET_ID = 202, WOUND_ID = 203, BURN_ID = 204, VULN_ID = 205, CONFUSE_ID = 206; // estados de campaña nuevos (S03 01/11): Red y Herida
function validate(p) {
  p.builder = p.builder <= 0 ? 1 : p.builder; p.recruit = p.recruit <= 0 ? 1 : p.recruit; p.mage = p.mage <= 0 ? 1 : p.mage;
  p.brick = Math.max(0, p.brick); p.weapon = Math.max(0, p.weapon); p.crystal = Math.max(0, p.crystal);
  if (p.wall < 0) { p.castle += p.wall; p.wall = 0; }
  if (p.castle <= 0) p.castle = 0;
  if (p.capCastle != null && p.castle > p.capCastle) p.castle = p.capCastle;
  if (p.capWall != null && p.wall > p.capWall + (p.tempWall || 0)) p.wall = p.capWall + (p.tempWall || 0); // (el muro de bicho de "se entierra" no cuenta para el tope)
}
function statAdd(p, a) { KEYS.forEach((k, i) => { p[k] += a[i]; }); validate(p); }
/* ---------- Golpes (S04, 20/10): detalle de cada cambio de muro y castillo, en orden, para animar la destrucción y la reconstrucción ----------
   Cada evento 'play' y 'turn' trae `golpes: [{ asiento, objetivo: 'muro'|'castillo', cantidad, tipo, origen }]`.
   cantidad: con signo (−8 = daño, +6 = construcción/cura). La suma por asiento y objetivo da exacto el después − el antes del evento.
   tipo: 'normal' (la carta jugada: daño al muro o construcción), 'directo' (daño de la carta que va directo al castillo),
         'desborde' (lo que sobra cuando el daño tira el muro y sigue al castillo), 'pasiva' (gnomos +4 directo, humanos muro +1),
         'trampa', 'efecto' (efectos de 3 turnos y reglas de campaña), 'rey' (acción del rey, Ataque del rey, inventos de Fizzwick),
         'costo' (muro que se paga como costo, p. ej. Reforma).
   origen: id de la carta, o el nombre del efecto/trampa ('rain', 'livingwall', 'mines', 'moat'…) o la raza del rey.
   Los golpes de DAÑO (los que salen de statRemove) traen además arma, altura y color (shared/hits.js); construcciones, costos y
   pérdidas propias (Berserker, moneda) no los traen.
   Las simulaciones de la IA no lo registran (_noGl). */
function glBegin(g) { if (g._gl || g._noGl) return false; g._gl = []; g._gs = g.players.map((p) => [p.wall, p.castle]); g._glCtx = { tipo: 'normal', origen: null }; return true; }
function glCtx(g, tipo, origen) { const prev = g._glCtx; if (g._gl) { glMark(g); g._glCtx = { tipo, origen }; } return prev; }
function glRestore(g, prev) { if (g._gl) { glMark(g); g._glCtx = prev; } }
// registra lo que cambió desde la última marca con el contexto actual
function glMark(g, tipo = g._glCtx?.tipo, origen = g._glCtx?.origen) {
  if (!g._gl) return;
  g.players.forEach((p, i) => { const [w, c] = g._gs[i];
    if (p.wall !== w) g._gl.push({ asiento: i, objetivo: 'muro', cantidad: p.wall - w, tipo, origen });
    if (p.castle !== c) g._gl.push({ asiento: i, objetivo: 'castillo', cantidad: p.castle - c, tipo, origen });
    g._gs[i] = [p.wall, p.castle]; });
}
function glEnd(g, mine) { if (!mine) return null; glMark(g); const l = g._gl; g._gl = null; g._gs = null; g._glCtx = null; return l; }
// foe: el daño viene del rival (cartas, efectos, rey o trampas suyas); por defecto, si no es el turno de p
// Unidad herida (regla general, Juan 14/10): si te sacan una unidad que no tenés para dar (estás en 1), no bajás de 1 pero queda herida:
// en tu próximo turno esa unidad no produce y después vuelve sola. p.wounded es una máscara: 1 constructores, 2 soldados, 4 magos.
export const WOUND = { builder: 1, recruit: 2, mage: 4 };
export const woundedList = (p) => Object.keys(WOUND).filter((k) => (p.wounded || 0) & WOUND[k]);
// Piso al robo (Juan 27/10): lo que te saca el rival no te deja un recurso por debajo de lo que producís de él por turno
const UNIT_OF = { brick: 'builder', weapon: 'recruit', crystal: 'mage' };
export const resFloor = (g, p, k) => (OPT.stealFloor && !g.campaign && UNIT_OF[k] ? Math.max(0, p[UNIT_OF[k]] || 0) : 0);
export const stealable = (g, p, k) => Math.max(0, (p[k] || 0) - resFloor(g, p, k));
// Ceniza (Juan 27/10, consenso drow): lo que el piso le frena al drow se vuelve daño SOLO al muro rival (sin muro se pierde; nunca al castillo)
export function ashHit(g, p, blocked, fx) {
  if (!OPT.ash || !(blocked > 0) || g.campaign) return 0;
  const n = Math.min(p.wall, Math.round(blocked * OPT.ash)); if (n <= 0) { fx.push('ash:0'); return 0; }
  const o = other(g, p), x2 = o.x2; o.x2 = false; const pc = glCtx(g, 'pasiva', 'ash'); const ka = g._kingAct; g._kingAct = false; statRemove(g, p, [0, 0, 0, 0, 0, 0, n, 0], false, fx, true); g._kingAct = ka; glRestore(g, pc); o.x2 = x2; // el escudo la frena y se gasta; Venganza la cuenta siempre (también la de Vaelith)
  fx.push('ash:' + n); return n;
}
function statRemove(g, p, a, keep, fx, foe = g.turn !== g.players.indexOf(p), pas7 = 0) {
  glMark(g); // lo que venía antes, con su contexto
  let ashB = 0;
  if (foe && p.immuneLeft > 0 && a.slice(0, 6).some((v) => v > 0)) { a = a.slice(); for (let i = 0; i < 6; i++) if (a[i] > 0) a[i] = 0; p.immuneLeft--; fx.push('rule:immune'); } // Esfera rúnica: ignora tus primeros N efectos
  if (foe && OPT.stealFloor && !g.campaign && (a[1] > 0 || a[3] > 0 || a[5] > 0)) { a = a.slice(); for (const i of [1, 3, 5]) if (a[i] > 0) { const m = Math.min(a[i], stealable(g, p, KEYS[i])); if (other(g, p).race === 'drow') ashB += Math.min(a[i], Math.max(0, p[KEYS[i]])) - m; /* solo lo que frenó el piso, no lo que no había */ a[i] = m; } }
  let glDw = 0, glDc = 0;
  for (const [i, k] of [[0, 'builder'], [2, 'recruit'], [4, 'mage']]) if (a[i] > 0) { if (p[k] - a[i] < 1) { p.wounded = (p.wounded || 0) | WOUND[k]; fx.push('wound:' + k); } else fx.push('kill:' + k); }
  for (let i = 0; i < 6; i++) p[KEYS[i]] -= a[i];
  const o = other(g, p), hits = a[6] > 0 || a[7] > 0, w0 = p.wall, c0 = p.castle;
  if (!p.noDamage) {
    const x2on = OPT.x2Wall ? a[6] > 0 : hits; // Sed de sangre: solo duplica el daño al muro (no el directo); si el ataque es solo directo, sigue esperando
    const m = o.x2 && x2on ? 2 : 1; if (m === 2) { if (!keep) o.x2 = false; fx.push('double'); }
    let dw = a[6] * m; let dc = a[7] * (OPT.x2Wall ? 1 : m);
    if (p.camp && hits) { // campaña: Soborno de guardia (mitad), Escudo de runas (el muro no baja de…), Piel de jabalí (castillo a salvo)
      if (p.halfNext) { dw = Math.floor(dw / 2); dc = Math.floor(dc / 2); p.halfNext = false; fx.push('camp:half'); }
      if (p.wallFloor != null && p.wall - dw < p.wallFloor) { dw = Math.max(0, p.wall - p.wallFloor); fx.push('camp:runes'); }
      if (p.castleShield && (dc > 0 || dw > p.wall)) { dc = 0; dw = Math.min(dw, p.wall); p.castleShield = false; fx.push('camp:hide'); }
    }
    if (p.veil > 0 && hits && foe) { const t = Math.min(p.veil, dw + dc); const fromW = Math.min(t, dw); dw -= fromW; dc -= t - fromW; p.veil = 0; fx.push('camp:veil'); } // Velo (drow): el próximo golpe hace −N
    if (p.frenzy > 0 && hits && foe) { dw = Math.ceil(dw * FURY_CFG.recv); dc = Math.ceil(dc * FURY_CFG.recv); } // Frenesí (orco): recibís +50 %
    if (p.hand?.includes(VULN_ID) && hits) { dw = Math.ceil(dw * 1.5); dc = Math.ceil(dc * 1.5); fx.push('camp:vuln'); } // Vulnerable: +50 % de daño
    if (p.intangible && hits && foe) { const t = dw + dc; dc = t > 0 ? 0 : dc; dw = t > 0 ? 1 : dw; fx.push('rule:intangible'); } // intangible: cada golpe le hace 1
    if (p.guardHalf && hits && foe) { dw = Math.ceil(dw / 2); dc = Math.ceil(dc / 2); fx.push('rule:guardHalf'); } // Guardián en modo muralla
    if (p.flyLeft > 0 && hits && foe) { dw = Math.ceil(dw / 2); dc = Math.ceil(dc / 2); p.flyLeft--; fx.push(p.flyLeft ? 'rule:fly' : 'rule:flyDown'); } // vuelo: mitad de daño hasta que le pegás N veces
    if (p.thorns > 0 && hits && foe) { const q = other(g, p); q.wall -= p.thorns; if (q.wall < 0) { q.castle += q.wall; q.wall = 0; } fx.push('rule:thorns'); } // espinas: tu ataque te lastima el muro
    if (p.minionHp > 0 && dw > 0) { const t = Math.min(dw, p.minionHp); p.minionHp -= t; dw -= t; fx.push('minion:' + t); if (p.minionHp <= 0) { p.minionHp = 0; p.atkPlus = (p.atkPlus || 0) + (p.minionRage || 0); fx.push('rule:minionDown'); } } // secuaz: tus ataques le pegan primero
    p.wall -= dw; p.castle -= dc; glDw = dw; glDc = dc; if (!OPT.x2Wall) pas7 *= m;
  } else {
    if (o.x2 && (OPT.x2Wall ? a[6] > 0 : hits) && !keep) o.x2 = false;
    if (hits && !keep) { p.noDamage = false; fx.push('shield'); }
  }
  validate(p);
  if (g._gl) { // golpes: muro, después el castillo repartido en directo / pasiva / desborde
    const i = g.players.indexOf(p), [gw, gc] = g._gs[i], tipo = g._glCtx?.tipo || 'normal', origen = g._glCtx?.origen ?? null;
    const hit = hitOf(origen, other(g, p).race) || { arma: null, altura: null, color: null }; // tipo de golpe (hits.js): arma, altura y color de la magia
    const wl = gw - p.wall, cl = gc - p.castle, over = Math.max(0, glDw - Math.max(0, gw)), pas = Math.min(glDc, Math.max(0, pas7)), base = glDc - pas;
    if (wl) g._gl.push({ asiento: i, objetivo: 'muro', cantidad: -wl, tipo, origen, ...hit });
    let left = cl; const d1 = Math.max(0, Math.min(left, base)); left -= d1; const d2 = Math.max(0, Math.min(left, pas)); left -= d2; const d3 = left; // d3: lo que pasó del muro (más cualquier resto)
    if (d1) g._gl.push({ asiento: i, objetivo: 'castillo', cantidad: -d1, tipo: tipo === 'normal' ? 'directo' : tipo, origen, ...hit });
    if (d2) g._gl.push({ asiento: i, objetivo: 'castillo', cantidad: -d2, tipo: 'pasiva', origen, ...hit });
    if (d3) g._gl.push({ asiento: i, objetivo: 'castillo', cantidad: -d3, tipo: over > 0 ? 'desborde' : tipo, origen, ...hit });
    g._gs[i] = [p.wall, p.castle];
  }
  // Venganza: todo el daño recibido durante el turno rival (cartas, efectos, rey, monedas, Horda)
  if (hits && g.turn !== g.players.indexOf(p) && !g._kingAct) p.dmgRound = (p.dmgRound || 0) + Math.max(0, w0 - p.wall) + Math.max(0, c0 - p.castle);
  if (ashB) ashHit(g, p, ashB, fx);
  if (hits && foe) { const att = g.players[g.turn]; if (att && att !== p) att.dmgTurn = (att.dmgTurn || 0) + Math.max(0, w0 - p.wall) + Math.max(0, c0 - p.castle); } // daño hecho este turno (Sangre por sangre)
  if (hits && (w0 > p.wall || c0 > p.castle)) { if (p.furyOn && foe) furyAdd(g, p, 1 + (p.furyRecv || 0) + (p.hideFury || 0), fx); if (o.furyOn && foe && g.turn === g.players.indexOf(o)) { furyAdd(g, o, 1, fx); o.hitTurn = true; } p.hideFury = 0; } // Furia: +1 por golpe recibido y por golpe dado
  if (hits && foe && p.runes?.length && !g._storm && (w0 > p.wall || c0 > p.castle)) runeStorm(g, p, fx); // ⚡ Tormenta: te pegan → devuelve
  if (hits && g.hooks) fire(g, 'onDamage', { seat: g.players.indexOf(p), from: foe ? 1 - g.players.indexOf(p) : g.players.indexOf(p), wall: Math.max(0, w0 - p.wall), castle: Math.max(0, c0 - p.castle), fx });
}
// Pagar el costo: se descuenta tal cual (el escudo propio o la Furia rival no lo tocan)
function payCost(p, c) { for (let i = 0; i < 8; i++) p[KEYS[i]] -= c[i] || 0; validate(p); }
const other = (g, p) => (p === g.players[0] ? g.players[1] : g.players[0]);

// Costo efectivo según la raza (elfos: cartas de cristales 2 menos, mínimo 1; gnomos: sus máquinas 2 menos, mínimo 1) y Luto
export function costOf(p, id, sleeve = false) {
  const c = CARDS[id][0].slice(), ka = FX[id]?.k === 'kingAttack'; // el Ataque del rey no es carta de un recurso: no lo abaratan las pasivas de raza
  if (p.race === 'elfo' && c[5] > 0 && !ka) c[5] = Math.max(1, c[5] - 2);
  if (p.race === 'gnomo' && !p.noPassive && GNOME_MACHINES.includes(id)) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] = Math.max(1, c[i] - 2); // inventores: sus máquinas cuestan 2 menos (antes: cartas de 6+ armas 1 menos, pisaba al orco)
  if (lutoOn(p)) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] += 2;
  if (p.halfId === id) for (const i of [1, 3, 5, 8]) c[i] = 0; // invento del rey gnomo: gratis ese turno
  if (p.costMod) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] = Math.max(1, c[i] + (p.costMod[i] || 0)); // campaña: regla de jefe o equipo que encarece/abarata
  if (p.inqRes && c[p.inqRes] > 0) c[p.inqRes] *= 2; // (S03 11/11) Heraldo Inquisidor: el recurso prohibido cuesta el doble
  if (p.chains?.includes(id) && !ka) { let m = 1; for (const i of [3, 5]) if (c[i] > c[m]) m = i; c[m] += p.chainCost || 3; } // Forjador de Cadenas: soltar la carta encadenada cuesta 3 más
  if (p.hand?.includes(194)) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] += 1; // estado Pánico: todo cuesta 1 más
  if (p.hand?.includes(CONFUSE_ID)) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] = Math.max(0, c[i] + ((id * 7 + (p.confSeed || 0)) % 5) - 2); // estado Confusión: cada carta cuesta de −2 a +2 al azar (fijo en el turno)
  if (sleeve && OPT.sleeveTier) { // Juan 27/10: recargo de la manga por rareza: mítica +2 de cada recurso, legendaria +1, rara +1 solo en el recurso más caro ("+0,5"), común 0
    const add = MYTHIC.has(id) ? 2 : LEGENDARY.has(id) ? 1 : 0; if (add) { for (const i of [1, 3, 5, 8]) if (c[i] > 0) c[i] += add; }
    else if (RARE.has(id) || RARE_RACE.has(id)) { let m = -1; for (const i of [1, 3, 5, 8]) if (c[i] > 0 && (m < 0 || c[i] > c[m])) m = i; if (m >= 0) c[m] += 1; }
  } else if (sleeve) for (const i of [1, 3, 5, 8]) if (c[i] > 0) c[i] = OPT.sleeveAdd ? c[i] + (OPT.sleeveLegend && LEGENDARY.has(id) ? OPT.sleeveLegend : OPT.sleeveAdd) : Math.ceil(c[i] * SLEEVE_MULT); // desde la manga: 1/3 más (o un recargo fijo)
  if (p.camp) campCost(p, id, c); // campaña: Juramento, Plan de batalla, Cuerno de batalla, Talismán de hoja
  if (p.siegeCut > 0) for (const i of [1, 3, 5]) if (c[i] > 0) c[i] = Math.max(1, Math.round(c[i] * (1 - p.siegeCut))); // (Juan 01/11) asedio final: desde cierto turno las cartas cuestan cada vez menos
  return c;
}
// ¿Puede el rey bajar a atacar? (mítica): rey propio, despierto y con la carga mínima
export const kingKO = (p) => p.kingStun > 0 || !!p.stunTurn; // rey desmayado (incluye el turno en que se recupera)
export const isGuestKing = (p, id) => FX[id]?.k === 'kingAttack' && !!raceOf(id) && !!p.race && raceOf(id) !== p.race; // Grieta: la mítica de otro rey liberado (no pide tu rey ni lo desmaya)
export const kingAttackOk = (p, id) => { const f = FX[id]; if (f?.k !== 'kingAttack') return true; if (p.devKA) return true; if (isGuestKing(p, id)) return true; /* modo DEV: sin requisito de carga ni de rey despierto */ return hasKing(p) && !(p.kingStun > 0) && !p.stunTurn && !(OPT.mythicNoKingTurn && p.kingAuto) && (p.kingCharge || 0) >= (f.minCharge || 0); }; // no el mismo turno en que tu rey actuó solo (Juan 27/10)
// Luto: mientras el rey esté desmayado (incluido el turno en que se recupera) las cartas cuestan 2 más
export const playableSleeve = (p) => p.sleeve != null && playable(p, p.sleeve, true);
export const lutoOn = (p) => !!p.luto && (p.kingStun > 0 || !!p.stunTurn);
export const thiefCap = (p) => 8; // (los drow ya no roban extra con el Ladrón)
export function playable(p, id, sleeve = false) {
  if (FX[id]?.k === 'trade' && !RES3.some((k) => (p[k] || 0) >= 3)) return false; // Trueque: algo para entregar (2 de costo + 1)
  if (sleeve && p.tradeTurn) return false; // turno con Trueque: no se juega el As
  if (p.pactOn && stuck(id) && !p.arrowOnly) return true; // Pacto (drow): las maldiciones y estados se juegan (cuestan 0)
  if (stuck(id) || !kingAttackOk(p, id)) return false;
  if (p.arrowOnly && id !== ARROW && id !== ARROW + PLUS) return false; // ventana de Flechas (elfo): solo Flechas
  if (FX[id]?.camp && !campPlayable(p, id)) return false;
  if (p.hand?.includes(NET_ID) && (CARDS[id][2][6] > 0 || CARDS[id][2][7] > 0 || FX[id]?.k === 'horde')) return false; // estado Red: este turno no jugás ataques // campaña: oro, cartas de fuera de pelea, Taller de urgencia sin Obras
  const s = stats(p), c = costOf(p, id, sleeve);
  if (c[7] && p.castle <= c[7]) return false; // pagar con castillo (orcos de campaña): no te podés matar
  if (CARDS[id][1][6] < 0 && p.wall < -CARDS[id][1][6]) return false; // "tu muro −3" (Berserker, Sacrificio, Pacto): sin ese muro no se juega (Juan 26/10)
  if (c[8] && (p.favor || 0) < c[8]) return false;
  for (let i = 0; i < 8; i++) if (s[i] < c[i]) return false;
  return !(s[0] <= c[0] || s[2] <= c[2] || s[4] <= c[4]);
}

// Juega la carta en la posición i de la mano del jugador de turno.
// Devuelve un evento para animar; si es Espía o Sabotaje deja g.pending y el turno sigue abierto.
// Vectores reales de una carta (condicionales, pasivas de raza y efectos), antes de trampas y Furia.
export function cardVectors(g, p, o, id, sleeve = false) {
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
      188: () => { op[7] = (o.brick || 0) + (o.weapon || 0) + (o.crystal || 0) < 15 ? 22 : 10; }, // Golpe de sombra: remate del drow
      178: () => { op[6] = p.wall < 10 ? 16 : 10; },
    }[id]; if (bonus) bonus();
  }
  // campaña: cartas con efecto que depende del estado (oro, muro, estados del rival…)
  if (special?.camp?.dyn) special.camp.dyn({ g, p, o, id, plus: !!special.plus, s, op });
  // Horda: tus armas + 3 por soldado + 1 (antes de pagar la carta); después le suman pasivas y Tambores como a cualquier ataque
  if (special?.k === 'horde') op[6] = Math.max(0, (p.weapon || 0) - costOf(p, id, sleeve)[3]) + 3 * (p.recruit || 0) + 1; // las armas que te quedan después de pagarla (antes contaba también las del costo: críticos 2, 26/10)
  // pasivas de raza sobre los vectores
  if (p.race === 'enano' && s[6] > 0 && !p.noPassive) s[6] += 2; /* noPassive: el enano de campaña (juega a las runas) */ // Juan 27/10: +2 (antes +3)
  if (p.race === 'orco' && s[6] > 0 && !p.noPassive) s[6] = Math.max(0, s[6] - 1);
  if (p.race === 'orco' && !p.noPassive && op[6] + op[7] >= 6) { if (op[6] > 0) op[6] += 1; else op[7] += 1; }
  if (p.race === 'drow' && !p.noPassive && !(OPT.pesteNoDrow && id === 49)) for (const k of [1, 3, 5]) if (op[k] > 0) op[k] = Math.ceil(op[k] * OPT.drowMult);
  if (OPT.pesteNoUnits && id === 49) { op[0] = 0; op[2] = 0; op[4] = 0; }
  // elfos, maestros arqueros (Juan 22/10: +2; 25/10: +3, elfo Difícil 47,6 → 52,2)
  if (p.race === 'elfo' && !p.noPassive && ARROW_IDS.has(id) && (op[6] > 0 || op[7] > 0)) { if (op[6] > 0) op[6] += 3; else op[7] += 3; }
  // tambores de guerra: ataques +3
  if (p.effects?.some((e) => e.e === 'drums') && (op[6] > 0 || op[7] > 0)) { if (op[6] > 0) op[6] += 4; else op[7] += 4; }
  // gnomos, máquinas de asedio: contra un muro de 25 o más, sus ataques de 10+ (contando Tambores) mandan además 4 directo al castillo
  let pas7 = 0; if (p.race === 'gnomo' && !p.noPassive && op[6] >= 10 && o && o.wall >= 25 && special?.k !== 'kingAttack') { op[7] += 4; pas7 = 4; } // (el rey no es máquina de asedio)
  // campaña: furia acumulada (regla de jefe), ataque extra con castillo bajo, maldición Miedo (−1 al daño), estado Brecha (muro a la mitad)
  if (op[6] > 0 || op[7] > 0) {
    if (p.rage) { if (op[6] > 0) op[6] += p.rage; else op[7] += p.rage; }
    if (p.lowCastleBonus && p.castle < p.lowCastleBonus.below) { if (op[6] > 0) op[6] += p.lowCastleBonus.amount; else op[7] += p.lowCastleBonus.amount; }
    if (p.hand?.includes(192)) { if (op[6] > 0) op[6] = Math.max(0, op[6] - 1); else op[7] = Math.max(0, op[7] - 1); }
    { const b = (p.camp ? campAtkBonus(p) : 0) + (p.atkPlus || 0) + (p.minionHp > 0 ? p.minionAtk || 0 : 0) + (p.warlord ? p.recruit || 0 : 0) + (p.hand?.includes(564) || p.hand?.includes(1564) ? 2 * p.hand.filter((h) => h === 564 || h === 1564).length : 0); if (b) { if (op[6] > 0) op[6] += b; else op[7] += b; } if (p.atkMul > 1) { op[6] *= p.atkMul; op[7] *= p.atkMul; } if (p.frenzy > 0) { const fb = p.frenzyAtk || 0; if (op[6] > 0) op[6] = (op[6] + fb) * 2; else op[7] = (op[7] + fb) * 2; } } /* atkPlus y secuaz también desde la vista (realOf: la carta muestra el daño real) */ // Furia de sangre, Estandarte, Tambor de huesos; enemigos: ritual, enjambre, furia, secuaz
  }
  if (s[7] > 0 && (p.noHeal || p.noHealT || (p.venom > 0 && o?.webNoHeal))) s[7] = 0; // Ojos rojos / Telarañas: no te podés curar
  if (s[6] > 0 && p.nextWall) s[6] += p.nextWall; // Formación (humano)
  if (s[6] > 0 && p.wallGloves) s[6] = Math.max(0, s[6] - 1);
  if (s[6] > 0 && p.wallMinus) s[6] = Math.max(0, s[6] - p.wallMinus); // Arco de la luna (contra) // Guantes de albañil (contra): tus cartas de muro dan −1
  if (s[6] > 0 && p.hand?.includes(193)) s[6] = Math.floor(s[6] / 2);
  // asedio prolongado sobre mí: no puedo subir el muro
  let siege = false; if (p.effects?.some((e) => e.e === 'siegelock') && s[6] > 0) { s[6] = 0; siege = true; }
  return { s, op, siege, pas7 };
}
// i = posición en la mano, o 'sleeve' para jugar la carta de la manga (cuesta +2 de cada recurso y no se repone).
export function play(g, i, choice = null) { // choice: elección de la carta (Trueque: { give, get, n })
  const mine = glBegin(g), prev = g._glCtx;
  let ev = null; g._choice = choice; try { ev = playInner(g, i); } finally { g._choice = null; if (!mine && g._gl) { glMark(g); g._glCtx = prev; } }
  const gl = glEnd(g, mine); if (ev && mine) ev.golpes = gl;
  return ev;
}
function playInner(g, i) {
  if (g.winner != null || g.pending || g.phase === 'sleeve') return null;
  const seat = g.turn, p = g.players[seat], o = other(g, p), fromSleeve = i === 'sleeve', id = fromSleeve ? p.sleeve : p.hand[i];
  if (id == null || !playable(p, id, fromSleeve)) return null;
  if (g.hourglass && FX[id]?.k === 'extraTurn') return null; // el Reloj no se encadena (sí se puede después de una Rápida)
  const c = costOf(p, id, fromSleeve); if (p.halfId === id) p.halfId = null;
  const before = [stats(g.players[0]), stats(g.players[1])];
  const fx = [], special = FX[id] || null;
  if (!fromSleeve) p.used.push(id); p.acted = true;   // (26/10, críticos) la carta de la manga se usa una sola vez: no va al descarte (antes volvía al mazo al rebarajar y la mítica se jugaba 2 veces)
  const sp = SPECIAL[id];
  if (fromSleeve) { if (!g.dev) p.sleeve = null; fx.push('sleeve'); } // modo DEV: la carta de la manga no se gasta (para probarla muchas veces)
  else if (p.hand.length > handSize(p) || (p.rapidNoDraw && RAPID.has(id))) { p.hand.splice(i, 1); if (p.rapidNoDraw && RAPID.has(id)) fx.push('eq:leafTalisman'); } else p.hand[i] = draw(g, p); // la carta extra del rey elfo no se repone; Talismán de hoja (contra): tus Rápidas no roban
  let { s, op, siege, pas7 } = cardVectors(g, p, o, id, fromSleeve); if (siege) fx.push('siegeLocked');
  const tipo0 = g._kingInvent || special?.k === 'kingAttack' ? 'rey' : 'normal'; glMark(g); if (g._gl) g._glCtx = { tipo: tipo0, origen: id };
  // moneda: se tira antes, así el extra de daño es parte del mismo ataque (escudo, Furia, trampas, pasivas)
  let coin = null;
  if (special?.k === 'coin') { const win = g.devCoin != null ? !!g.devCoin : g._rnd() < (special.p ?? 0.5);   /* devCoin: el campo de prueba fuerza cara/cruz */ coin = (win ? special.heads : special.tails) || null; fx.push(win ? 'coinHeads' : 'coinTails'); if (coin?.opp) for (let k = 0; k < 8; k++) op[k] += coin.opp[k]; }
  // trampas del rival
  let cancelled = false;
  if (o.trap) {
    // hechizo = carta que se paga con cristales y te afecta (daño, sacarte algo o tu rey: desmayo, carga, Luto, Usurpación — críticos 2, 26/10)
    const t = o.trap, isSpell = c[5] > 0 && special?.k !== 'kingAttack' && (op.some((v) => v > 0) || ['stunKing', 'drainKing', 'luto', 'usurp'].includes(special?.k)), isWeapon = c[3] > 0, isMelee = MELEE_IDS.has(id), isArrow = ARROW_IDS.has(id), hits = op[6] > 0 || op[7] > 0;
    let fired = false; const o6 = op[6], o7 = op[7]; // (Juan 01/11) cuánto frenó o devolvió la trampa, para mostrarlo
    if (t === 'moat' && isMelee && hits) { op[6] = Math.floor(op[6] / 2); op[7] = Math.floor(op[7] / 2); pas7 = Math.floor(pas7 / 2); fired = true; }
    if (t === 'counterspell' && isSpell) { cancelled = true; o.crystal += 5; fired = true; }
    if (t === 'ambush' && isWeapon) { const pc = glCtx(g, 'trampa', t); statRemove(g, p, [0, 0, 0, 0, 0, 0, 6, 0], false, fx, true); glRestore(g, pc); fired = true; }
    if (t === 'spynet' && (c[1] + c[3] + c[5]) >= 10) { o.crystal += 8; o.spyNext = true; fired = true; }
    if (t === 'militia' && hits) { o.recruit += 1; fired = true; }
    if (t === 'irongate' && op[7] > 0) { op[7] = 0; pas7 = 0; fired = true; }
    if (t === 'mirage' && isArrow && hits) { const pc = glCtx(g, 'trampa', t); statRemove(g, p, [0, 0, 0, 0, 0, 0, op[6], op[7]], false, fx, true); glRestore(g, pc); op[6] = 0; op[7] = 0; pas7 = 0; fired = true; }
    if (t === 'landmine' && isMelee) { const pc = glCtx(g, 'trampa', t); statRemove(g, p, [0, 0, 0, 0, 0, 0, 10, 0], false, fx, true); glRestore(g, pc); fired = true; }
    if (fired) { fx.push('trap:' + t); const tv = t === 'moat' ? o6 + o7 - op[6] - op[7] : t === 'irongate' ? o7 : t === 'mirage' ? o6 + o7 : 0; if (tv) fx.push('trapv:' + tv); o.trap = null; o.trapSeen = false; }
  }
  if (sp === 'spy' || sp === 'sabotage') {
    if (id >= 50 || id === 5) payCost(p, c); // las de raza y el Espía pagan; el Sabotaje original no
    g.pending = { type: sp, seat };
    if (id === 5) { // Espía: además de ver la mano, quema la próxima carta del mazo rival (sale del juego)
      const o = g.players[1 - seat]; const burned = draw(g, o); if (burned != null) { g.pending.burned = burned; fx.push('burn:' + burned); }
    }
    if (RAPID.has(id) && (g.rapidUsed || 0) < 1) { g.rapidUsed = (g.rapidUsed || 0) + 1; g.rapidPending = true; fx.push('rapid'); }
    return { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])] };
  }
  if (c[8]) p.favor = Math.max(0, (p.favor || 0) - c[8]);
  glMark(g); payCost(p, c); glMark(g, 'costo', id);
  if (p.camp) campPay(p, id, c, fx);
  if (cancelled) { fx.push('cancelled'); devClamp(g); return { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])] }; }
  // efectos de las cartas originales (después del Contrahechizo: si la anula, no pasa nada)
  if (sp === 'thief') { const cap = thiefCap(p); for (const k of ['brick', 'weapon', 'crystal']) { const t = Math.min(cap, g.campaign ? o[k] : stealable(g, o, k)); p[k] += t; o[k] -= t; } }
  if (sp === 'block') o.statsType = 4;
  if (sp === 'allWeapon') p.statsType = 2;
  if (sp === 'allCrystal') p.statsType = 3;
  if (sp === 'allBrick') p.statsType = 1;
  if (sp === 'shield') p.noDamage = true;
  let kaGuarded = false;
  if (special?.k === 'kingAttack') { // el rey baja a pelear: si el rival tiene Guardia real, la carga se anula (igual queda desmayado)
    fx.push('kingAttack');
    if (o.kingGuard && !OPT.guardNoMythic) { o.kingGuard = false; op = op.map(() => 0); kaGuarded = true; fx.push('kingGuarded'); }
  }
  const castleBefore = o.castle;
  // robos (Saqueadores, Diplomacia: lo que te sacan = lo que ganás): no ganás más de lo que el rival tenía (críticos 2, 26/10)
  { const base = CARDS[id]; for (const k of [1, 3, 5]) if (base[1][k] > 0 && base[1][k] === base[2][k]) s[k] = Math.min(s[k], g.campaign ? Math.max(0, o[KEYS[k]]) : stealable(g, o, KEYS[k])); }
  statAdd(p, s);
  { const x2 = (OPT.noX2King && special?.k === 'kingAttack') || (OPT.x2Wall && fromSleeve) ? p.x2 : null; if (x2 != null) p.x2 = false; statRemove(g, o, op, false, fx, undefined, pas7); if (x2 != null) p.x2 = x2; }
  // Ataque del rey: si el golpe llegó al castillo (rompió el muro), el rival pierde además 1 de cada unidad; si el muro aguantó, solo el daño
  if (special?.k === 'kingAttack' && !kaGuarded && o.castle < castleBefore) { fx.push('kingBreak'); const u = OPT.mythicOneUnit ? [[0, 'builder'], [2, 'recruit'], [4, 'mage']][Math.floor(g._rnd() * 3)][0] : -1; statRemove(g, o, u < 0 ? [1, 0, 1, 0, 1, 0, 0, 0] : [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i === u ? 1 : 0)), false, fx); } // Juan 27/10: 1 sola unidad al azar
  if (sp === 'double') p.x2 = true; // el próximo ataque, no este
  // efectos especiales de las cartas de raza
  if (special) {
    const k = special.k;
    if (k === 'edicto') { const ca = Math.floor((p.castle + o.castle) / 2), wa = Math.floor((p.wall + o.wall) / 2); p.castle = o.castle = Math.max(1, ca); p.wall = p.effects?.some((e) => e.e === 'siegelock') && wa > p.wall ? p.wall : wa; o.wall = wa; fx.push('edicto'); }
    if (k === 'wallToCastle') { const m = OPT.gateHalf ? Math.ceil(p.wall / 2) : OPT.gateCap ? Math.min(p.wall, OPT.gateCap) : p.wall; p.castle += m; p.wall -= m; fx.push('wallToCastle'); }
    if (k === 'cycle2') { const costly = p.hand.map((cid, j) => [j, cid, CARDS[cid][0].reduce((x, y) => x + y, 0)]).filter(([, cid]) => !playable(p, cid) && !stuck(cid)).sort((x, y) => y[2] - x[2]).slice(0, 2); for (const [j, cid] of costly) { p.used.push(cid); p.hand[j] = draw(g, p); } fx.push('cycle'); }
    if (k === 'doubleCrystal') p.statsType = 5;
    if (k === 'extraTurn') { g.extraTurn = 2; g.hourglass = true; fx.push('extraTurn'); }
    if (k === 'horde') { p.weapon = 0; fx.push('horde'); } // el daño ya salió en op (cardVectors)
    if (k === 'trap') { p.trap = special.t; p.trapSeen = !TRAPS.hidden || (TRAPS.drowSee && o.race === 'drow') || !!o.seeTraps; fx.push('trapSet'); }
    if (k === 'trade') { const t = tradeResolve(p, g._choice); if (t) { p[t.give] -= 2 + t.n; p[t.get] += t.n; fx.push('trade:' + t.give + ':' + t.get + ':' + t.n); } p.tradeTurn = true; }
    if (k === 'revealTrap') { if (o.trap) { o.trapSeen = true; fx.push('trapReveal:' + o.trap); } else fx.push('trapReveal:none'); }
    if (k === 'effect') { const tgt = special.onOpp ? o : p; tgt.effects.push({ e: special.e, turns: special.turns + (special.e === 'drums' || special.e === 'siegelock' ? 1 : 0), from: seat }); fx.push('effectSet'); }
    if (k === 'usurp') { if (o.kingGuard) { o.kingGuard = false; fx.push('kingGuarded'); } else { const take = Math.min(2, o.kingCharge || 0); o.kingCharge -= take; p.kingCharge += take; fx.push('kingDrain'); } }
    if (k === 'kingNow') { if (hasKing(p)) { p.kingCharge = 0; const ka = kingAct(g, p); fx.push('kingNow'); if (ka.fx) fx.push(...ka.fx); const kn = { ...ka, fx: [...(ka.fx || [])] }; if (p.kingDouble) { p.kingDouble = false; const k2 = kingAct(g, p); if (k2.fx) fx.push(...k2.fx); kn.mid = k2.before; kn.fx2 = k2.fx || []; kn.after = k2.after; kn.fx = kn.fx.concat(k2.fx || [], ['double']); if (k2.played) kn.played2 = k2.played; } g._kingNowEv = kn; } } /* kingNow en el evento: la pantalla muestra la acción del rey como cuando actúa solo (Juan 29/10) */ // Doble corona también cuenta acá
    if (k === 'kingDouble') { p.kingDouble = true; fx.push('kingDouble'); }
    if (k === 'luto') { fx.push('luto'); if (o.kingGuard) { o.kingGuard = false; fx.push('kingGuarded'); } else { o.luto = true; o.kingStun = Math.max(o.kingStun, 1); fx.push('kingStun'); } }
    if (k === 'stunKing' || k === 'drainKing') {
      if (o.kingGuard) { o.kingGuard = false; fx.push('kingGuarded'); }
      else { if (k === 'stunKing') o.kingStun = Math.max(o.kingStun, special.turns); if (special.drain) o.kingCharge = Math.max(0, o.kingCharge - special.drain); if (special.all) o.kingCharge = 0; fx.push(k === 'stunKing' ? 'kingStun' : 'kingDrain'); }
    }
    if (k === 'guardKing') { p.kingGuard = true; fx.push('kingGuard'); }
    if (k === 'wakeKing') { p.kingStun = 0; p.stunTurn = false; p.luto = false; p.kingCharge += special.charge || 0; fx.push('kingWake'); }
    if (k === 'chargeKing') { if (!kingKO(p)) { p.kingCharge += special.charge || 0; fx.push('kingCharge'); } else fx.push('kingCharge:0'); } // desmayado no carga (críticos 5)
    if (k === 'coin' && coin) { // lo de daño al rival ya se sumó al ataque; acá lo propio
      if (coin.self) statAdd(p, coin.self); if (coin.selfCost) payCost(p, coin.selfCost); if (coin.selfDmg) { const d = coin.selfDmg.slice(); d[6] = Math.min(d[6], Math.max(0, p.wall)); statAdd(p, d.map((v) => -v)); } // "tu muro −10": pérdida propia (no la frena tu escudo ni la dobla la Furia rival)
    }
    if (k === 'giveCurse') { giveCard(g, special.target === 'self' ? p : o, special.id); fx.push('curse:' + special.id); }
    if (k === 'bug') { // acción de bicho (campaña, enemigos.md): efectos además del daño del vector
      if (special.give && !(special.giveMax && o.hand.filter((h) => h === special.give).length >= special.giveMax)) { giveCard(g, o, special.give); fx.push('curse:' + special.give); } // giveMax: no te mete más de N de esa (Negreros: 2 Miedos)
      if (special.atkUp) { p.atkPlus = (p.atkPlus || 0) + special.atkUp; fx.push('rule:atkUp'); }
      if (special.selfDestruct) { p.castle = 0; fx.push('rule:selfDestruct'); } // Polvorín: explota y se va (ganás la pelea si aguantaste)
      if (special.wallUp) { p.wall += special.wallUp; validate(p); fx.push('rule:wallUp'); }
      if (special.acid) { const x = Math.min(Math.max(0, o.wall), op[6]); if (x > 0) { o.wall -= x; fx.push('rule:acid'); } } // ácido (Lodos): le pega otra vez lo mismo a tu muro
      if (special.tempWall) { p.tempWall = (p.tempWall || 0) + special.tempWall; p.wall += special.tempWall; fx.push('rule:burrowWall'); }
      if (special.pages || special.hits > 1) { const n = special.pages ? Math.max(1, p.pageHits || 1) : special.hits; for (let h = 1; h < n; h++) { const pc = glCtx(g, 'normal', id); statRemove(g, o, [0, 0, 0, 0, 0, 0, op[6], 0], false, fx); glRestore(g, pc); } fx.push((special.pages ? 'pages:' : 'hits:') + n); }
    }
    if ((p.pattern || p.weights) && special?.k === 'bug') bugAdvance(g, p);
    if (k === 'kingAttack' && isGuestKing(p, id)) fx.push('guestKing:' + raceOf(id)); // rey invitado: tu rey no se desmaya (Juan 27/10)
    else if (k === 'kingAttack' && !g.dev) { p.kingStun = Math.max(p.kingStun || 0, special.stun || 2); fx.push('kingStun'); } // en DEV el rey no queda desmayado: se puede repetir el ataque // bajó a pelear: desmayado 2 turnos (mantiene la carga) // campaña: mete una maldición/estado en la mano del rival
  }
  if (special?.kingPlus && hasKing(p) && !kingKO(p)) { p.kingCharge = (p.kingCharge || 0) + special.kingPlus; fx.push('kingCharge'); } // cartas de rey: +1 de carga a tu rey (Juan 26/10)
  if (p.rage && (op[6] > 0 || op[7] > 0)) p.rage = 0; // la furia acumulada se gasta en el ataque
  if (p.camp) campAfter(g, p, o, id, special, fx, s, op, c);
  if (p.castle <= 0) p.castle = 0;
  if (RAPID.has(id) && (g.rapidUsed || 0) < 1) { g.rapidUsed = (g.rapidUsed || 0) + 1; g.rapidPending = true; fx.push('rapid'); }
  devClamp(g);
  const ev = { type: 'play', seat, card: id, fx, before, after: [stats(g.players[0]), stats(g.players[1])], sleeve: fromSleeve };
  if (g._kingNowEv) { ev.kingNow = g._kingNowEv; g._kingNowEv = null; }
  if (special?.k === 'trap') ev.trapSeen = !!p.trapSeen; // eventsFor: si la trampa queda oculta, el rival no ve qué carta fue
  glMark(g);
  if (g.hooks) { fire(g, 'onCardPlayed', { seat, id, ev, fx, attack: op[6] > 0 || op[7] > 0, dmg: op[6] + op[7] }); glMark(g, 'efecto', 'regla'); ev.after = [stats(g.players[0]), stats(g.players[1])]; }
  return ev;
}
/* ---------- Campaña estilo Slay the Spire (Juan 25/10): jugadas por turno, Obras, palabras clave, oro de la run ----------
   Todo esto corre solo si el jugador tiene p.camp (lo pone newGame cuando hay `campaign`). En PvP no se toca nada.
   Las cartas de campaña (shared/campaign-cards.js) traen FX[id].camp = { kw: ['quema'|'guardada'|'mano'|'obra'|'crece'],
   gold (costo en oro), can(p) (se puede jugar), outside (solo fuera de pelea), dyn(x) (cambia los vectores según el estado),
   after(x) (efecto después de jugarla), work: { tick(x), slots, atk, value } (Obra), start(x) (al empezar la pelea, Crece),
   end(x) (al terminar la pelea, Crece/oro) }. La versión mejorada (+) es otra carta: id + PLUS, con FX.plus = true. */
export const PLUS = 1000;
export const WORK_MAX = 3;
// jugadas de este turno: plays puede ser fraccionario para los enemigos (1,5 = 1 y 2 alternados: "actúa dos veces cada 2 turnos")
function campPlays(p) { const n = p.plays || 1, b = Math.floor(n); if (n === b) return b; p.playAcc = (p.playAcc || 0) + (n - b); if (p.playAcc >= 1 - 1e-9) { p.playAcc -= 1; return b + 1; } return b; }
export const campKw = (id, k) => !!FX[id]?.camp?.kw?.includes(k);
const owns = (p, id) => [p.deck, p.hand, p.used, p.burned || []].some((l) => l.includes(id) || l.includes(id + PLUS));
function campSeat(p, c) {
  // (S03 01/11, docs/campaña/enemigos.md) cuerpos de bicho: noProd (no produce: bestias y construcciones), pattern/weights (acciones de bicho
  // en orden fijo o con pesos), minion (secuaz: segundo muro con vida propia, efecto mientras vive y al caer)
  if (c.noProd) p.noProd = true; if (c.atk) p.atkPlus = (p.atkPlus || 0) + c.atk; /* atk: +N a todos sus ataques (para afinar enemigos) */ if (c.pattern) { p.pattern = c.pattern.slice(); p.patternLoop = c.patternLoop || 0; } if (c.weights) p.weights = { ...c.weights };
  if (c.fly) p.flyLeft = c.fly; if (c.immune) p.immuneLeft = c.immune; if (c.thorns) p.thorns = c.thorns; // vuelo (mitad de daño N golpes), inmune a N efectos, espinas
  if (c.minion) { p.minionHp = c.minion.hp; p.minionMax = c.minion.hp; p.minionAtk = c.minion.atk || 0; p.minionHeal = c.minion.heal || 0; p.minionRage = c.minion.rage || 0; p.minionName = c.minion.name || 'Secuaz'; }
  p.camp = true; p.plays = c.plays || 1; p.discardHand = !!c.discardHand;
  p.gold = c.gold || 0; p.goldStart = p.gold; p.maxCastle = c.maxCastle ?? p.castle; p.kills = c.kills || 0;
  p.grow = { ...(c.grow || {}) }; p.grown = {}; p.burned = []; p.works = (c.works || []).map((id) => ({ id, age: 0 }));
  p.statesGiven = 0; p.drawnBattle = 0; p.cyclesBattle = 0; p.turnPlays = 0; p.turnAtks = 0; p.turnAtk = 0; p.nextAtk = 0; p.cycleBonus = 0;
  for (const id of new Set(p.deck)) FX[id]?.camp?.start?.(campCtx(null, p, null, id, []));
}
function campInnate(p) {
  for (let j = p.deck.length - 1; j >= 0; j--) {
    const id = p.deck[j]; if (!campKw(id, 'mano')) continue;
    const k = p.hand.findIndex((h) => !campKw(h, 'mano')); p.deck.splice(j, 1);
    if (k >= 0) { p.deck.unshift(p.hand[k]); p.hand[k] = id; j++; } else p.hand.push(id);
  }
}
function campCost(p, id, c) {
  const zero = () => { for (const i of [1, 3, 5, 7, 8]) c[i] = 0; };
  if (p.freeTurn) return zero(); // Juramento: este turno todo cuesta 0
  if (p.firstFree && !p.playedAny) return zero(); // Cuerno de batalla: la primera carta de la pelea
  if (p.rapidFree && RAPID.has(id) && !p.turnRapidFree) return zero(); // Talismán de hoja: la primera Rápida de cada turno
  if (p.workTax && FX[id]?.camp?.work) { const k = [1, 3, 5].sort((a, b) => c[b] - c[a])[0]; c[k] += p.workTax; } // Engranaje eterno (contra): cada Obra cuesta +1
  if ((p.bloodLess || (p.furyOn && FURY_CFG.bloodLess)) && c[7] > 0) c[7] = Math.max(1, c[7] - (p.bloodLess || 0) - (p.furyOn ? FURY_CFG.bloodLess : 0)); // Tambor de sangre: las cartas de sangre cuestan 1 de vida menos
  let less = p.nextLess || 0; // Plan de batalla: la próxima carta cuesta N menos
  for (const i of [1, 3, 5]) { const d = Math.min(c[i], less); c[i] -= d; less -= d; }
}
export const goldCost = (p, id) => (p.freeTurn || (p.firstFree && !p.playedAny) ? 0 : FX[id]?.camp?.gold || 0);
function campPlayable(p, id) {
  const k = FX[id].camp; if (k.outside) return false;
  if (k.gold && (p.gold || 0) < goldCost(p, id)) return false;
  return !k.can || k.can(p);
}
function campPay(p, id, c, fx) {
  if (fx) { if (p.firstFree && !p.playedAny) fx.push('eq:warHorn'); if (p.rapidFree && RAPID.has(id) && !p.turnRapidFree) fx.push('eq:leafTalisman'); if (p.bloodCup && c[7] > 0) fx.push('eq:bloodCup'); }
  p.gold = (p.gold || 0) - goldCost(p, id);
  if (c[7] > 0) p.bloodPaid = (p.bloodPaid || 0) + c[7]; // vida pagada con cartas de sangre (el orco la recupera al ganar)
  if (p.nextLess && c) p.nextLess = 0;
  if (p.rapidFree && RAPID.has(id)) p.turnRapidFree = true;
  if (p.bloodCup && c[7] > 0) p.weapon += 2; // Copa de sangre
}
function campAtkBonus(p) { let b = (p.turnAtk || 0) + (p.nextAtk || 0); for (const w of p.works || []) b += FX[w.id]?.camp?.work?.atk || 0; return b; }
function campCtx(g, p, o, id, fx) {
  const x = { g, p, o, id, plus: !!FX[id]?.plus, fx };
  x.draw = (n) => { for (let i = 0; i < n; i++) { const d = draw(g, p); if (d == null) break; p.hand.push(d); p.drawnBattle++; } };
  x.give = (q, cid, n = 1) => { for (let i = 0; i < n; i++) { q.hand.push(cid); if (q !== p && isState(cid)) { p.statesGiven++; if (p.poisonVial || q.poisonVial) q.keepStates = Math.max(q.keepStates || 0, 1); } } fx.push('give:' + cid); };
  x.giveDeck = (q, cid, n = 1) => { for (let i = 0; i < n; i++) q.deck.splice(Math.floor(g._rnd() * (q.deck.length + 1)), 0, cid); fx.push('giveDeck:' + cid); };
  x.states = (q) => q.hand.filter(isState).length;
  x.hurt = (dmg, direct = 0, q = o, origen = 'obra:' + id) => { if (dmg <= 0 && direct <= 0) return; const pc = glCtx(g, 'efecto', origen); statRemove(g, q, [0, 0, 0, 0, 0, 0, dmg, direct], false, fx, q !== p); glRestore(g, pc); };
  x.grow = (gid, n = 1) => { p.grown[gid] = (p.grown[gid] || 0) + n; fx.push('grow:' + gid); };
  x.growth = (gid) => (p.grow[gid] || 0) + (p.grown[gid] || 0) + (p.grow[gid + PLUS] || 0) + (p.grown[gid + PLUS] || 0);
  x.runWorks = (times = 1, mult = 1) => { for (let t = 0; t < times; t++) for (const w of p.works.slice()) FX[w.id]?.camp?.work?.tick?.({ ...campCtx(g, p, o, w.id, fx), w, mult }); };
  x.addWork = (wid) => campAddWork(g, p, o, wid, fx);
  // Veneno y Pactos (drow)
  x.venom = (n, q = o) => venomAdd(q, n * (p.queenNight && p.veil > 0 ? 2 : 1), fx); x.pact = () => { const i = p.hand.findIndex(stuck); if (i < 0) return false; const cid = p.hand.splice(i, 1)[0]; pactPlay(g, p, o, cid, fx, false); return true; };
  x.curses = () => [...p.deck, ...p.used, ...p.hand].filter(isCurse).length;
  // Caldera e Inventos (gnomo)
  x.press = (n) => boilerAdd(g, p, n, fx); x.release = (mode) => boilerRelease(g, p, mode, fx); x.inv = (bid) => invLevel(p, bid);
  // Flechas y Ojo de águila (elfo)
  x.arrows = (n) => { for (let i = 0; i < n; i++) p.hand.push(ARROW); fx.push('arrow:' + n); }; x.eye = (n) => eagleEye(g, p, n, fx);
  // Furia (orco): sumar/bajar, entrar en Frenesí; hit = golpe extra con el Frenesí (x2)
  x.fury = (n) => (n >= 0 ? furyAdd(g, p, n, fx) : furyCalm(p, -n, fx)); x.frenzyNow = () => frenzyStart(g, p, fx);
  x.hit = (n) => x.hurt(p.frenzy > 0 ? (n + (p.frenzyAtk || 0)) * 2 : n, 0, o, id);
  // Runas (enano): grabar / romper (S03 08/11)
  x.rune = (t, n = 1) => { for (let i = 0; i < n; i++) runeGrabar(g, p, t, fx); };
  x.runes = () => (p.runes || []).length; x.runeFree = () => (p.runes || []).length < runeSlots(p);
  x.breakOld = () => runeRomper(g, p, 0, fx); x.breakAll = () => { let n = 0; while ((p.runes || []).length && !p.noBreak) { runeRomper(g, p, 0, fx); n++; } return n; };
  x.echo = () => { for (const t of (p.runes || []).slice()) runeAct(g, p, t, 1, fx); };
  return x;
}
function campAddWork(g, p, o, id, fx) {
  const slots = (w) => FX[w]?.camp?.work?.slots || 1, need = slots(id);
  while (p.works.length && p.works.reduce((a, w) => a + slots(w.id), 0) + need > WORK_MAX) { const old = p.works.shift(); fx.push('workGone:' + old.id); }
  p.works.push({ id, age: 0 }); fx.push('work:' + id);
  if (owns(p, 259)) { const pl = [p.deck, p.hand, p.used, p.burned].some((l) => l.includes(259 + PLUS)); p.grown[259] = (p.grown[259] || 0) + (pl ? 2 : 1); } // Patente: cada Obra construida en la run
}
function campAfter(g, p, o, id, special, fx, s, op, c) {
  const k = special?.camp, attack = op[6] > 0 || op[7] > 0;
  if (attack) { p.nextAtk = 0; p.turnAtks++; if (p.drumFury && p.furyOn) furyAdd(g, p, 1, fx); if (p.atkVenom) venomAdd(o, p.atkVenom, fx); }
  p.turnPlays++; p.playedAny = true;
  if (s[6] > 0 && p.nextWall) p.nextWall = 0;
  if (k?.invent) p.lastInvent = id;
  if (p.martialLaw && s[0] + s[2] + s[4] > 0) { campCtx(g, p, o, id, fx).hurt(3, 0, o, 'regla'); fx.push('camp:martial'); } // Ley marcial (humano)
  if (p.kingFront && p.turnPlays === 1 && !campKw(id, 'quema') && !k?.work && !stuck(id)) { statAdd(p, s); statRemove(g, o, op, false, fx); fx.push('camp:twice'); } // Rey al frente: la 1.ª carta del turno, dos veces
  if (p.boilerOn && !g._kingInvent) boilerAdd(g, p, (k?.pressure ?? 1) + (p.wallPress && s[6] > 0 ? p.wallPress : 0), fx); // Caldera (gnomo): cada carta suma su presión
  if (k?.invent) { p.inv = { ...(p.inv || {}) }; p.inv[baseId(id)] = (p.inv[baseId(id)] || 0) + (p.invDouble ? 2 : 1); fx.push('invent:+' + p.inv[baseId(id)]); } // Invento: mejora cada vez que lo jugás
  if (p.wallGloves && s[6] > 0) { campCtx(g, p, o, id, fx).hurt(2, 0, o, 'regla'); fx.push('eq:wallGloves'); } // Guantes de albañil
  if (p.bloodCup && s[7] < 0) { p.weapon += 2; fx.push('eq:bloodCup'); } // Copa de sangre: perdiste castillo por tu carta
  if (p.pactOn && stuck(id)) { pactPlay(g, p, o, id, fx); return; }
  if (!k) return;
  const x = campCtx(g, p, o, id, fx);
  k.after?.(x);
  if (k.work) { x.addWork(id); k.work.build?.(x); }
  if (k.kw?.includes('quema')) { const j = p.used.lastIndexOf(id); if (j >= 0) p.used.splice(j, 1); p.burned.push(id); fx.push('exhaust:' + id); }
}
function campBeforeEnd(g, q, fx) { // Susurro venenoso: el que termina su turno con estados en la mano pierde castillo
  if (q.furyOn) furyEnd(g, q, fx);
  if (q.boilerOn) boilerEnd(g, q, fx);
  q.noHealT = 0;
  const src = other(g, q), n = q.hand.filter(isState).length;
  { const nb = q.hand.filter((id) => id === BURN_ID).length; if (nb) { const pc = glCtx(g, 'efecto', 'burn'); statRemove(g, q, [0, 0, 0, 0, 0, 0, 0, 3 * nb], false, fx, true); glRestore(g, pc); fx.push('camp:burn'); } } // Quemadura: −3 castillo si te queda en la mano
  if (src.poison && n) { const pc = glCtx(g, 'efecto', 'poison'); statRemove(g, q, [0, 0, 0, 0, 0, 0, 0, src.poison * n], false, fx, true); glRestore(g, pc); fx.push('camp:poison'); }
}
function campDiscardHand(g, p) {
  const keep = []; for (const id of p.hand) { if (id === ARROW || id === ARROW + PLUS) continue; /* las Flechas que no tiraste se pierden */ if (isState(id) || campKw(id, 'guardada')) keep.push(id); else p.used.push(id); } // las maldiciones también se van al descarte (vuelven cuando las levantás, como en Slay the Spire)
  p.hand = keep; while (p.hand.length < handSize(p)) { const d = draw(g, p); if (d == null) break; p.hand.push(d); }
}
/* (S03 10/11, pedido de S10) Enfurecimiento: todo enemigo de campaña (asiento 1), desde su turno ENRAGE.at, pega +ENRAGE.step más por turno
   (acumulativo), para que ninguna pelea se estire.
   Vista: op.enrageIn (turnos que faltan; 0 = ya está enfurecido), op.enrage (cuánto suma). fx (en effects del turno): 'enrage:<n>'. */
// both: desde ese mismo turno tus ataques también suben (muerte súbita: la pelea se termina para un lado o para el otro)
export const ENRAGE = { at: 8, step: 1, both: 1 };
function campTurnStart(g, p, o, log) {
  if (g.campaign && p === g.players[1] && !p.noEnrage) { p.campTurns = (p.campTurns || 0) + 1; if (p.campTurns >= ENRAGE.at) { p.enrage = (p.enrage || 0) + ENRAGE.step; p.atkPlus = (p.atkPlus || 0) + ENRAGE.step; log.push('enrage:' + p.enrage); } }
  if (g.campaign && p === g.players[0] && ENRAGE.both && (o.campTurns || 0) >= ENRAGE.at) { p.enrage = (p.enrage || 0) + ENRAGE.both; p.atkPlus = (p.atkPlus || 0) + ENRAGE.both; log.push('enrage:me:' + p.enrage); } // muerte súbita: vos también
  if (p.venom > 0) venomTick(g, p, log, true);
  p.dmgTurn = 0; campTurnExtras(g, p, o, log);
  p.brakeTurn = false; p.arrowsTurn = 0; p.aimTurn = 0; p.arrowPlusTurn = 0; if (p.arrowTurn) { for (let i = 0; i < p.arrowTurn; i++) p.hand.push(ARROW); log.push('arrow:' + p.arrowTurn); } if (p.eyeTurn) eagleEye(g, p, p.eyeTurn, log);
  p.hitTurn = false; p.drumFury = false; p.turnPlays = 0; p.turnAtks = 0; p.turnAtk = 0; p.nextAtk = 0; p.freeTurn = false; p.cycleBonus = 0; p.turnRapidFree = false;
  if (p.wallFloorTurns > 0) p.wallFloorTurns--; else p.wallFloor = null; // Escudo de runas
  p.castleShield = false; // Piel de jabalí: dura hasta tu próximo turno
  p.wallT0 = p.wall; if (p.runes) { p.stormLeft = p.runes.filter((t) => t === 'tormenta').length; for (let k = 0; k < (p.runeTimes || 1); k++) for (const t of p.runes.slice()) { const rf = []; runeAct(g, p, t, 1, rf); log.push(...rf.map((f) => f.replace('rune:act', 'rune:turno'))); } }
  const mult = 1 + (p.workBoost || 0) + (p.workDouble ? 1 : 0); p.workBoost = 0;
  for (const w of p.works.slice()) { const fx = []; FX[w.id]?.camp?.work?.tick?.({ ...campCtx(g, p, o, w.id, fx), w, mult }); w.age++; log.push('work:' + w.id); }
}
/* ---------- Runas del enano (S03 08/11, docs/campaña/razas.md §1) ----------
   p.runes = ['piedra'|'fuego'|'oro'|'tormenta', …] (la más vieja primero), p.runeSlots (3; Cincel rúnico / Forja nv3: 4).
   Actúan solas al empezar tu turno (p.runeTimes veces: Runa maestra / Corona de basalto = 2). Romper = efecto x3 (p.breakMul; Cincel: x2).
   Grabar con las ranuras llenas rompe sola la más vieja. fx: 'rune:grabar:<t>', 'rune:romper:<t>', 'rune:act:<t>' (al empezar tu turno: 'rune:turno:<t>'). */
export const RUNES = ['piedra', 'fuego', 'oro', 'tormenta'];
// (S03 08/11, medido con camp_grind RAZA=enano): Piedra +2 (el doc decía +3: con +3 el enano ganaba el doble de runs que el humano);
// thorg = muro que da Thorgrim al enano jugador en la campaña (no cura castillo; con 30+ de muro da la mitad)
export const RUNE_CFG = { piedra: 2, fuego: 2, oro: 1, tormenta: 3, breakMul: 3, thorg: 2 };
export const runeSlots = (p) => p.runeSlots || 3;
function runeAct(g, p, t, mult, fx) {
  const o = other(g, p), m = p.runeMod || {}, pc = glCtx(g, 'efecto', 'runa:' + t);
  const K = RUNE_CFG;
  if (t === 'piedra') p.wall += Math.max(0, K.piedra + (m.piedra || 0)) * mult;
  else if (t === 'fuego') statRemove(g, o, [0, 0, 0, 0, 0, 0, Math.max(0, K.fuego + (m.fuego || 0)) * mult, 0], false, fx, true);
  else if (t === 'oro') { const k = ['brick', 'weapon', 'crystal'].sort((a, b) => p[a] - p[b])[0]; p[k] += K.oro * mult; }
  else if (t === 'tormenta' && mult > 1) statRemove(g, o, [0, 0, 0, 0, 0, 0, K.tormenta * mult, 0], false, fx, true); // al romperla: los 3 de golpe, x3
  glRestore(g, pc); fx.push('rune:act:' + t);
}
function runeGrabar(g, p, t, fx) {
  if (!RUNES.includes(t)) return; p.runes ||= [];
  if (p.runes.length >= runeSlots(p)) { if (p.noBreak) { p.runes.shift(); fx.push('rune:gastar:' + t); } else runeRomper(g, p, 0, fx); }
  p.runes.push(t); if (t === 'tormenta') p.stormLeft = (p.stormLeft || 0) + 1; fx.push('rune:grabar:' + t);
}
function runeRomper(g, p, i, fx) {
  if (!p.runes?.length || p.noBreak) return null; const t = p.runes.splice(i, 1)[0]; fx.push('rune:romper:' + t);
  runeAct(g, p, t, p.breakMul || RUNE_CFG.breakMul, fx);
  if (t === 'oro' && p.oroTreasure) { p.brick += 5; p.weapon += 5; p.crystal += 5; fx.push('camp:oroTreasure'); } // Tesoro de la montaña
  if (p.echoBreak && !p.rs?.echoUsed) { p.rs ||= {}; p.rs = { ...p.rs, echoUsed: true }; p.runes.push(t); fx.push('rune:grabar:' + t, 'eq:yunqueEcos'); } // Yunque de ecos: se vuelve a grabar (1 por pelea)
  return t;
}
function runeStorm(g, p, fx) { // ⚡ Tormenta: cuando te pegan, cada runa de Tormenta devuelve 3 (una vez por turno cada una)
  if (!(p.stormLeft > 0)) return; const o = other(g, p), n = p.stormLeft; p.stormLeft = 0; g._storm = true;
  try { const pc = glCtx(g, 'efecto', 'runa:tormenta'); statRemove(g, o, [0, 0, 0, 0, 0, 0, RUNE_CFG.tormenta * n * (p.runeTimes || 1), 0], false, fx, true); glRestore(g, pc); } finally { g._storm = false; }
  fx.push('rune:act:tormenta');
}
// (S03 10/11) cartas de sinergias.md que actúan al empezar tu turno
function campTurnExtras(g, p, o, log) {
  if (p.factory) { const best = p.used.filter((h) => FX[h]?.camp?.invent).sort((a, b) => (p.inv?.[baseId(b)] || 0) - (p.inv?.[baseId(a)] || 0))[0]; if (best != null) { p.used.splice(p.used.indexOf(best), 1); p.hand.push(best); log.push('camp:factory'); } } // Fábrica (gnomo)
  if (p.plagueQueen) { const n = [...p.deck, ...p.used, ...p.hand].filter(isCurse).length; if (n) { venomAdd(o, n, log); log.push('camp:plagueQueen'); } } // Plaga reina (drow)
  const ira = p.hand.filter((h) => h === 517 || h === 1517).length; if (ira && p.furyOn) furyAdd(g, p, 2 * ira, log); // Ira contenida (orco)
  if (p.livingMountain && p.wall >= 4) { const pc = glCtx(g, 'efecto', 'montaña'); statRemove(g, o, [0, 0, 0, 0, 0, 0, Math.floor(p.wall / 4), 0], false, log, true); glRestore(g, pc); log.push('camp:mountain'); } // Montaña viva (enano)
}
/* ---------- Veneno y Pactos del drow (S03 08/11, razas.md §1) ----------
   q.venom: al empezar SU turno pierde esa cantidad de castillo (ignora el muro) y el veneno baja 1 (p.venomDecay del que lo puso: Telaraña 2;
   p.venomHold: Frasco de sombra, no baja el 1.er turno). Pacto (p.pactOn): las maldiciones y estados se pueden jugar (costo 0): se queman y dan
   +2 de veneno al rival (VENOM_CFG.pact, +p.pactBonus; x2 con p.pactMul / el 1.er pacto con p.firstPactX2). fx: 'venom:<n>', 'venom:tick:<daño>', 'pact:<id>'. */
// (S03 08/11, camp_grind RAZA=drow) healWin: al ganar una pelea el drow cura 4 (sin eso, y sin el sostén del humano, ganaba 1-2 % de las runs)
export const VENOM_CFG = { pact: 2, decay: 1, healWin: 0 };
// (S03 11/11) daño de una regla de jefe (Heraldos): pasa por el motor (secuaz, Velo, Vulnerable, hooks onDamage) y define el ganador
export function campHit(g, q, dmg, direct, fx = []) { if (g.winner != null || !(dmg > 0 || direct > 0)) return; statRemove(g, q, [0, 0, 0, 0, 0, 0, Math.max(0, dmg || 0), Math.max(0, direct || 0)], false, fx, true); if (q.castle <= 0 && g.winner == null) g.winner = 1 - g.players.indexOf(q); }
export function campVenom(q, n) { if (n > 0) q.venom = (q.venom || 0) + n; }
function venomAdd(q, n, fx) { if (!q || n <= 0) return; q.venom = (q.venom || 0) + n; fx.push('venom:' + q.venom); }
function venomTick(g, q, fx, decay = true) {
  const src = other(g, q), n = q.venom || 0; if (n <= 0) return; const pc = glCtx(g, 'efecto', 'veneno'); statRemove(g, q, [0, 0, 0, 0, 0, 0, 0, n], false, fx, true); glRestore(g, pc); fx.push('venom:tick:' + n);
  if (decay && !src.venomNoDecay) { if (src.venomHold && !src.rs?.vh) { src.rs = { ...(src.rs || {}), vh: true }; } else q.venom = Math.max(0, n - (src.venomDecay || VENOM_CFG.decay)); }
  if (q.castle <= 0 && g.winner == null) g.winner = g.players.indexOf(src);
}
function pactPlay(g, p, o, id, fx, fromPlay = true) {
  const j = p.used.lastIndexOf(id); if (fromPlay && j >= 0) p.used.splice(j, 1); (p.burned ||= []).push(id);
  let n = VENOM_CFG.pact + (p.pactBonus || 0); if (p.pactMul) n *= p.pactMul; if (p.firstPactX2 && !p.rs?.fp) { n *= 2; p.rs = { ...(p.rs || {}), fp: true }; }
  venomAdd(o, n, fx); fx.push('pact:' + id, 'exhaust:' + id);
  if (fromPlay && p.freePact && !p.rs?.fpf) { p.rs = { ...(p.rs || {}), fpf: true }; g.freePlay = true; fx.push('eq:veloSombra'); } // Velo de sombra: el 1.er pacto no gasta jugada
}
/* ---------- Caldera e Inventos del gnomo (S03 08/11, razas.md §1) ----------
   p.boilerOn, p.pressure 0..boilerMax (10): cada carta suma su presión (FX.camp.pressure, 1 si no dice; negativa = baja).
   Al terminar tu turno: p.boilerMode 'dmg' (daño = presión x1,5), 'wall' (muro = presión x1,5) o 'hold' (sigue sumando); sin elección la decide
   el motor (boilerAuto: libera con 7 o más). Si pasa del máximo, explota: 10 a TU castillo y vuelve a 0. E.boilerSet(g, modo) = la UI elige.
   Inventos (FX.camp.invent): mejoran cada vez que los jugás en la pelea (p.inv[id]; x.inv(id) = veces ya jugado + bonus).
   fx: 'boiler:<presión>', 'boiler:release:<modo>:<cantidad>', 'boiler:boom', 'invent:+<n>'. */
// (S03 08/11) liberar = presión x1,5 (el doc decía x2: con x2 el gnomo ganaba ~14 % de las runs con la aldea vacía y 77 % construida, el humano 11 / 63)
export const BOILER_CFG = { max: 10, boom: 10, mult: 1.5, auto: 7 };
const baseId = (id) => (id > PLUS ? id - PLUS : id);
const invLevel = (p, bid) => (p.inv?.[bid] || 0) + (p.invBonus || 0);
export const boilerMax = (p) => BOILER_CFG.max + (p.boilerMaxMod || 0);
function boilerAdd(g, p, n, fx) {
  if (!p.boilerOn || !n) return; p.pressure = Math.max(0, (p.pressure || 0) + n); fx.push('boiler:' + p.pressure);
  if (p.pressure > boilerMax(p)) { if (p.autoRelease) { const n = p.pressure; p.pressure = 0; const o = other(g, p), pc = glCtx(g, 'efecto', 'caldera'); statRemove(g, o, [0, 0, 0, 0, 0, 0, n, 0], false, fx, true); glRestore(g, pc); fx.push('boiler:release:dmg:' + n); return; } // Válvula maestra
    if (p.brakeTurn) { p.pressure = boilerMax(p); fx.push('boiler:brake'); return; } boilerBoom(g, p, fx); }
}
function boilerBoom(g, p, fx) {
  const o = other(g, p); p.pressure = 0; fx.push('boiler:boom');
  if (p.safeValve) { p.safeValve = false; fx.push('eq:valvulaSeguridad'); } else { const pc = glCtx(g, 'efecto', 'caldera'); statRemove(g, p, [0, 0, 0, 0, 0, 0, 0, p.boomDmg || BOILER_CFG.boom], false, fx, false); glRestore(g, pc); }
  if (p.overPressure) { const pc = glCtx(g, 'efecto', 'caldera'); statRemove(g, o, [0, 0, 0, 0, 0, 0, 0, 10], false, fx, true); glRestore(g, pc); }
  if (p.castle <= 0 && g.winner == null) g.winner = 1 - g.players.indexOf(p);
}
function boilerRelease(g, p, mode, fx) {
  const n = Math.round((p.pressure || 0) * BOILER_CFG.mult * (p.releaseMul || 1)); p.pressure = 0; if (n <= 0) return 0;
  if (mode === 'wall') p.wall += n; else { const o = other(g, p), pc = glCtx(g, 'efecto', 'caldera'); statRemove(g, o, [0, 0, 0, 0, 0, 0, n, 0], false, fx, true); glRestore(g, pc); }
  fx.push('boiler:release:' + (mode === 'wall' ? 'wall' : 'dmg') + ':' + n); return n;
}
export function boilerAuto(g, p) { if ((p.pressure || 0) < BOILER_CFG.auto) return 'hold'; return p.wall < 8 || other(g, p).wall > 20 ? 'wall' : 'dmg'; }
function boilerEnd(g, p, fx) { const m = p.boilerMode || boilerAuto(g, p); p.boilerMode = null; if (m === 'hold') return; boilerRelease(g, p, m, fx); }
// La UI elige qué hacer con la caldera al terminar este turno: 'dmg' | 'wall' | 'hold' (si no elige, decide boilerAuto)
export function boilerSet(g, mode) { const p = g.players[g.turn]; if (!p?.boilerOn || !['dmg', 'wall', 'hold'].includes(mode)) return null; p.boilerMode = mode; return { type: 'boiler', seat: g.turn, mode }; }
/* ---------- Flechas y Puntería del elfo (S03 08/11, razas.md §1) ----------
   Flecha (440): costo 0, daño 2 + Puntería, Se quema, no gasta jugada (g.freePlay); las que no tirás se pierden al terminar el turno.
   p.aim = Puntería (la pelea), p.aimTurn (este turno), p.arrowPlusTurn (Flechas encadenadas), p.nextArrowX2 (Susurro), p.nextArrowPlus (Flecha de plata).
   Ojo de águila N: mirás las N de arriba del mazo y mandás al descarte las que no sirven (maldiciones/estados y las que no podés pagar);
   el motor elige solo (S10 puede hacerlo a mano después con eyePick). fx: 'arrow:<n>', 'eye:<n>:<descartadas>'. */
export const ARROW = 440;
export { arrowDmg }; // (campaign-cards.js: la misma fórmula la usa la carta Flecha)
function eagleEye(g, p, n, fx) {
  n = Math.max(0, n + (p.eyeMod || 0)); if (!n) return; if (!p.deck.length && p.used.length) { p.deck = p.used.slice(); p.used = []; shuffle(p.deck, g._rnd); }
  const top = p.deck.splice(Math.max(0, p.deck.length - n)), keep = [], out = [];
  for (const id of top) (isCurse(id) || isState(id) || !playable({ ...p, brick: p.brick + 6, weapon: p.weapon + 6, crystal: p.crystal + 6 }, id) ? out : keep).push(id);
  p.deck.push(...keep); p.used.push(...out); fx.push('eye:' + n + ':' + out.length);
}
/* ---------- Furia y Frenesí del orco (S03 08/11, razas.md §1) ----------
   p.furyOn (el orco de campaña), p.fury 0-10: +1 por golpe que das (que haga daño) y +1 por golpe que recibís. A 10 entrás en
   Frenesí (p.frenzy = turnos tuyos que quedan, 2): tus ataques x2 y recibís +50 %. Al terminar, la Furia vuelve a 0.
   fx: 'fury:<n>' (cuánto quedó), 'frenzy:start', 'frenzy:end', 'fury:calm'. */
export const FURY_MAX = 10, FURY_CFG = { frenzyTurns: 2, recv: 1.25, bloodLess: 0, healWin: 6, kingFury: 4, bloodBack: 1 };
// (S03 08/11, medido con camp_grind RAZA=orco): recv = cuánto más recibís en Frenesí (doc +50 %: el orco perdía 11 de vida por pelea contra 1,5 del humano);
// healWin/bloodBack = Sangre caliente (al ganar curás 10 + la vida que pagaste con sangre); kingFury = Furia que suma Gorrak al actuar
function furyAdd(g, p, n, fx) { if (!p.furyOn || n <= 0) return; if (p.frenzy > 0) return; p.fury = Math.min(FURY_MAX, (p.fury || 0) + n); fx.push('fury:' + p.fury); if (p.fury >= FURY_MAX) frenzyStart(g, p, fx); }
function furyCalm(p, n, fx) { const t = Math.min(n, p.fury || 0); p.fury = (p.fury || 0) - t; if (p.frenzy > 0 && n > 0) { p.frenzy = 0; p.fury = 0; fx.push('frenzy:end'); } fx.push('fury:calm'); return t; }
function frenzyStart(g, p, fx) { if (p.frenzy > 0) return; p.fury = FURY_MAX; p.frenzy = Math.max(1, (p.frenzyTurns || FURY_CFG.frenzyTurns) + (p.frenzyBonus || 0)); fx.push('frenzy:start'); if (p.frenzyHeal && !p.noHeal) { p.castle += p.frenzyHeal; fx.push('eq:trofeoCampeon'); } }
function furyEnd(g, p, fx) {
  if (p.frenzy > 0) { if (p.frenzyForever) return; if (--p.frenzy <= 0) { p.frenzy = 0; p.fury = 0; fx.push('frenzy:end'); } return; }
  if (p.furyDecay && !p.hitTurn && p.fury > 0) { p.fury = Math.max(0, p.fury - p.furyDecay); fx.push('fury:' + p.fury, 'eq:trofeoCampeon'); }
  p.castleRef = p.castle; // Venganza orca: lo que perdiste desde acá
}
const RUNE_V = { piedra: 3.2, fuego: 3, oro: 1.6, tormenta: 2.4 };
function campView(p) { return { ...(p.minionMax ? { minion: { name: p.minionName, hp: p.minionHp, max: p.minionMax } } : {}), ...(p.atkPlus ? { atkPlus: p.atkPlus } : {}), ...(p.minionMax ? { minionHp: p.minionHp, minionAtk: p.minionAtk || 0 } : {}), ...(p.tempWall ? { tempWall: p.tempWall } : {}), ...(p.pageHits ? { pageHits: p.pageHits } : {}), ...(p.noProd ? { noProd: true } : {}), ...(p.flyLeft ? { flyLeft: p.flyLeft } : {}), ...(p.immuneLeft ? { immuneLeft: p.immuneLeft } : {}), ...(p.thorns ? { thorns: p.thorns } : {}), ...(p.rs?.asleep ? { asleep: p.rs.asleep } : {}), ...(p.rs?.mode ? { mode: p.rs.mode } : {}), ...(p.atkMul > 1 ? { atkMul: p.atkMul } : {}), ...(p.intangible ? { intangible: true } : {}), gold: p.gold || 0, plays: p.plays || 1, works: (p.works || []).map((w) => ({ id: w.id, age: w.age })), workMax: WORK_MAX, burned: (p.burned || []).slice(), grown: { ...(p.grown || {}) }, discardHand: !!p.discardHand, turnPlays: p.turnPlays || 0, ...(p.runes ? { runes: p.runes.slice(), runeSlots: runeSlots(p) } : {}), ...(p.noPassive ? { noPassive: true } : {}), ...(p.enrage != null || p.campTurns != null ? { enrage: p.enrage || 0, enrageIn: Math.max(0, ENRAGE.at - (p.campTurns || 0)) } : {}), ...(p.furyOn ? { fury: p.fury || 0, furyMax: FURY_MAX, frenzy: p.frenzy || 0 } : {}), ...(p.pactOn ? { pact: true } : {}), ...(p.venom ? { venom: p.venom } : {}), ...(p.veil ? { veil: p.veil } : {}), ...(p.boilerOn ? { pressure: p.pressure || 0, boilerMax: boilerMax(p), boilerMode: p.boilerMode || null, inv: { ...(p.inv || {}) }, invBonus: p.invBonus || 0 } : {}), ...(p.aimOn ? { aim: (p.aim || 0) + (p.aimTurn || 0), arrowDmg: arrowDmg(p), arrowOnly: !!p.arrowOnly } : {}) }; }
function campClone(p) { return { ...(p.runes ? { runes: p.runes.slice() } : {}), works: (p.works || []).map((w) => ({ ...w })), burned: (p.burned || []).slice(), grown: { ...(p.grown || {}) } }; }
function campValue(p) { let v = 0; if (p.venom > 0) v -= p.venom * (p.venom + 1) / 2 * 0.9; if (p.veil) v += p.veil * 0.8; if (p.boilerOn) { const pr = p.pressure || 0, mx = boilerMax(p); v += pr * 1.6 - (pr > mx - 2 ? (pr - mx + 2) * 6 : 0); } if (p.aimOn) v += p.hand.filter((h) => h === ARROW || h === ARROW + PLUS).length * arrowDmg(p) * 0.3 + (p.aim || 0) * 3 + (p.arrowTurn || 0) * 5 + (p.eyeTurn || 0) * 2; if (p.furyOn) v += (p.fury || 0) * 1.4 + (p.frenzy || 0) * 7; if (p.runes) for (const t of p.runes) v += (RUNE_V[t] || 2) * (p.runeTimes || 1); for (const w of p.works || []) v += FX[w.id]?.camp?.work?.value ?? 6; if (p.halfNext) v += 5; if (p.castleShield) v += 4; if (p.wallFloor != null) v += 4; return v; }
// Campaña: meter una carta (maldición/estado) en la mano de un jugador; si la mano está llena, igual entra (la mano se agranda)
export function giveCard(g, p, id) { if (!CARDS[id]) return false; p.hand.push(id); if (p.poisonVial && isState(id)) p.keepStates = Math.max(p.keepStates || 0, 1); /* Frasco de veneno (contra): los estados del rival a vos también duran un turno más */ return true; }
// Campaña: sacar una maldición/estado de la mano (fogata, mercader, templo). Devuelve true si la sacó.
export function removeCard(g, seat, i) { const p = g.players[seat]; if (i < 0 || i >= p.hand.length) return false; p.hand.splice(i, 1); while (p.hand.length < handSize(p)) p.hand.push(draw(g, p)); return true; }

// Poder del rey según la raza
function kingAct(g, p) {
  const pc = glCtx(g, 'rey', p.race), ka = g._kingAct; g._kingAct = true; // Venganza no cuenta el golpe automático del rey (críticos 2, 26/10)
  try { return kingActInner(g, p); } finally { glRestore(g, pc); g._kingAct = ka; }
}
// Fizzwick elige (opción): la máquina que deja mejor la posición para él
function fizzPick(g, p) { const seat = g.players.indexOf(p); let best = GNOME_MACHINES[0], bv = -Infinity; for (const id of GNOME_MACHINES) { const c = cloneGame(g); const q = c.players[seat]; q.hand.push(id); q.halfId = id; c.pending = null; c.inExtra = false; c._kingInvent = true; if (!play(c, q.hand.length - 1)) continue; const v = evaluate(c, seat); if (v > bv) { bv = v; best = id; } } return best; }
function kingActInner(g, p) {
  const o = other(g, p), fx = [], before = [stats(g.players[0]), stats(g.players[1])], kw = p.kingWeak || 0; // kingWeak: Anillo de carga (contra), el efecto es 1 menor
  if (kw) fx.push('eq:anillo_carga');
  switch (p.race) {
    case 'humano': p.brick += 4 - kw; p.weapon += 4 - kw; p.crystal += 4 - kw; break;
    case 'enano': { const heal = (n) => { if (!OPT.thorgrimCap || g.campaign) p.castle += n; else if (p.castle < OPT.thorgrimCap) p.castle = Math.min(OPT.thorgrimCap, p.castle + n); }; if (g.campaign && p !== g.players[0]) { p.wall += 12 - kw; break; } /* (S03 10/11) Thorgrim enemigo en la campaña: muro +12, sin curar castillo (las peleas no terminaban) */
      if (g.campaign && p === g.players[0]) { /* (S03 08/11) campaña, el enano jugador: Thorgrim no cura el castillo (curaba en cada pelea y el enano ganaba 9 de cada 10): muro RUNE_CFG.thorg (la mitad con 30+) */ p.wall += (p.wall >= 30 ? RUNE_CFG.thorg / 2 : RUNE_CFG.thorg) - kw; break; } if (p.wall >= 30) heal(OPT.thorgrim - kw); else { p.wall += 12 - kw; heal(3 - kw); } break; } // Juan 29/10: cura castillo solo hasta 70 // 30 (antes 40): con el Ataque del rey en juego el enano caía a 45 %
    case 'elfo': p.crystal += 6 - kw; if (p.hand.length < handCap(p)) { p.hand.push(draw(g, p)); fx.push('draw'); } break;
    // drow: cristales −10 (Juan 22/10, para emparejar contra el elfo); ladrillos y armas −6
    case 'drow': { let ab = 0; for (const k of ['brick', 'weapon', 'crystal']) { const want = (k === 'crystal' ? 10 : 6) - kw, nv = Math.max(Math.min(o[k], resFloor(g, o, k)), o[k] - want); ab += Math.max(0, want - (o[k] - nv) - Math.max(0, want - o[k])); o[k] = nv; } ashHit(g, o, ab, fx); } o.favor = Math.max(0, (o.favor || 0) - 3); break;
    case 'gnomo': { // El Inventor: crea una máquina gnoma al azar y la juega gratis en el acto (no toca tu mano ni tu jugada)
      const nid = OPT.fizzBest ? fizzPick(g, p) : GNOME_MACHINES[Math.floor(g._rnd() * GNOME_MACHINES.length)];
      fx.push('invent:' + nid);
      const save = { inExtra: g.inExtra, extraTurn: g.extraTurn, rapidPending: g.rapidPending, rapidUsed: g.rapidUsed, cycled: g.cycled };
      p.hand.push(nid); p.halfId = nid; const pend = g.pending; g.pending = null; g.inExtra = false;
      const ki = g._kingInvent, x2 = OPT.noX2King ? p.x2 : null; if (x2 != null) p.x2 = false; g._kingInvent = true; const kaV = g._kingAct; g._kingAct = false; const ev = play(g, p.hand.length - 1); g._kingAct = kaV; g._kingInvent = ki; /* (Juan 28/10) Venganza SÍ cuenta lo que pega la máquina de Fizzwick (es una carta), no el golpe automático de los otros reyes */ if (x2 != null) p.x2 = x2; // el x2 no se aplica a la máquina del rey (críticos 4) // el invento cuenta como golpe del rey
      if (!ev) { p.hand.pop(); p.halfId = null; }
      if (p.hand.length > handSize(p) && p.hand.includes(nid) && !ev) p.hand.splice(p.hand.lastIndexOf(nid), 1);
      Object.assign(g, save); g.pending = pend || g.pending; p.halfId = null;
      if (ev) { fx.push('autoplay'); ev.auto = 'invent'; const u = p.used.lastIndexOf(nid); if (u >= 0) p.used.splice(u, 1); } // se crea y se juega: no queda en tu mazo
      const kev = { race: p.race, fx, before, after: [stats(g.players[0]), stats(g.players[1])], played: ev || null };
      if (g.hooks) fire(g, 'onKingAct', { seat: g.players.indexOf(p), ev: kev, fx });
      return kev;
    }
    case 'orco': { const x2 = OPT.noX2King ? p.x2 : null; if (x2 != null) p.x2 = false; statRemove(g, o, [0, 0, 0, 0, 0, 0, OPT.gorrak - kw, 0], false, fx); if (x2 != null) p.x2 = x2; if (p.furyOn && FURY_CFG.kingFury) furyAdd(g, p, FURY_CFG.kingFury, fx); break; }
  }
  if (p.castle <= 0) p.castle = 0;
  const kev = { race: p.race, fx, before, after: [stats(g.players[0]), stats(g.players[1])] };
  if (g.hooks) fire(g, 'onKingAct', { seat: g.players.indexOf(p), ev: kev, fx });
  return kev;
}
// Modo desarrollador: recursos fijos en 99, la partida no termina, mano editable, razas y pasivas cambiables
export function devClamp(g) { for (const p of g.players) if (hasKing(p) && p.kingCharge > kingPeriod(p)) p.kingCharge = kingPeriod(p); /* la carga del rey no pasa del tope (críticos 4, 27/10) */ if (g.dev?.infinite) for (const p of g.players) { p.brick = p.weapon = p.crystal = 99; p.favor = FAVOR_MAX; p.devKA = true; } }
export function devSetCard(g, seat, i, id) { if (!g.dev || !CARDS[id] || i < 0 || i >= g.players[seat].hand.length) return null; g.players[seat].hand[i] = id; return { type: 'devCard', seat, index: i, card: id }; }
export function devSetRace(g, seat, race, passives = true) {
  if (!g.dev) return null; const p = g.players[seat]; p.devRace = race || null; p.race = passives ? p.devRace : null;
  // la mítica de la manga sigue a la raza (Ataque del rey de ese rey)
  if (race && p.sleeve != null && MYTHIC.has(p.sleeve)) { const m = [...MYTHIC].find((id) => raceOf(id) === race); if (m) p.sleeve = m; }
  return { type: 'devRace', seat, race };
}
export function devPassives(g, on) { if (!g.dev) return; for (const p of g.players) p.race = on ? (p.devRace ?? p.race) : null; g.dev.passives = on; }
// Tope de mano: la base es HAND (5); se puede pasar con cartas extra hasta 6, los elfos hasta 8
export const handCap = (p) => handSize(p) + (p.race === 'elfo' ? 3 : 1);
// Cambiar carta: todos pueden cambiar 1 carta por turno sin perder el turno; los elfos, 2
export const cycleMax = (p) => (p.mantle ? 99 : (p.race === 'elfo' ? 2 : 1) + (p.camp ? 0 : OPT.cycles) + (p.cycleBonus || 0)); // campaña: Brisa / Bosque que responde suman; Manto del bosque sin límite
export const cyclesLeft = (g) => Math.max(0, cycleMax(g.players[g.turn]) - (g.cycles || 0));
export function cycle(g, i) {
  if (g.winner != null || g.pending || g.phase === 'sleeve' || !cyclesLeft(g)) return null;
  const p = g.players[g.turn]; if (i < 0 || i >= p.hand.length || stuck(p.hand[i])) return null;
  if (p.mantle && (g.cycles || 0) >= 3) { if (p.crystal < 1) return null; p.crystal -= 1; } // Manto del bosque: desde el 4.º cambio, 1 cristal
  const card = p.hand[i]; p.used.push(card); p.hand[i] = draw(g, p); g.cycles = (g.cycles || 0) + 1; g.cycled = true; p.acted = true; if (p.camp) p.cyclesBattle = (p.cyclesBattle || 0) + 1;
  return { type: 'cycle', seat: g.turn, card, left: cyclesLeft(g) };
}
export function aiMaybeCycle(g) {
  if (g.pending || g.winner != null || g.phase === 'sleeve') return null; const p = g.players[g.turn]; let ev = null, n = 0;
  while (cyclesLeft(g) && n < 8) {
    let worst = -1, wc = -1;
    p.hand.forEach((id, i) => { if (!playable(p, id) && !stuck(id)) { const cc = CARDS[id][0].reduce((x, y) => x + y, 0) + (CARDS[id][0][8] || 0) * 2; if (cc > wc) { wc = cc; worst = i; } } });
    if (worst < 0) break; ev = cycle(g, worst); n++;
  }
  return ev ? { ...ev, count: n } : null;
}

// Campaña: pasar el turno (botón): corta las jugadas que queden y después hay que llamar a endTurn como siempre
export function passTurn(g) {
  if (g.winner != null || g.pending || !g.campaign || g.phase === 'sleeve') return null;
  g.playsLeft = 0; g.extraTurn = 0; g.rapidPending = false; g.freePlay = false; g.passed = true; return { type: 'pass', seat: g.turn };
}
// Cortar las jugadas extra del Reloj de arena antes de tiempo
export function passExtra(g) {
  if (g.winner != null || g.pending || !g.inExtra) return null;
  g.extraTurn = 0; return { type: 'pass', seat: g.turn };
}
// Descarte (Juan 27/10): +3 del recurso de la carta descartada (+3 en total aunque descartes 3). pick = { card: posición en la mano
// (una de las descartadas), res: 'brick' | 'weapon' | 'crystal' }. Si la carta pide 2 recursos elegís uno; si solo pide recurso de raza
// o no tiene costo, +3 del recurso común más bajo (nunca recurso de raza). Sin pick (IA o cliente viejo) elige discardAuto.
export const RES3 = ['brick', 'weapon', 'crystal'];
export function discardRes(p, id) { // recursos que puede dar esa carta
  const c = costOf(p, id), r = RES3.filter((k, j) => c[1 + 2 * j] > 0);
  if (!r.length && CARDS[id]?.[1]?.[6] < 0) r.push('brick'); // "tu muro −N" (Reforma, Berserker…): ladrillos
  return r;
}
export const lowestRes = (p) => RES3.slice().sort((x, y) => p[x] - p[y])[0];
// Elección automática: entre los recursos que dan las cartas descartadas, el que más te falta para tu mejor carta que todavía no podés pagar
export function discardAuto(p, ids, hand = p.hand) {
  const opts = []; for (let j = 0; j < ids.length; j++) for (const k of discardRes(p, ids[j])) opts.push({ j, k });
  if (!opts.length) return { j: 0, k: lowestRes(p) };
  const want = hand.concat(p.sleeve != null ? [p.sleeve] : []).filter((id) => id != null && !stuck(id) && !playable(p, id, id === p.sleeve));
  let best = opts[0], bv = -1;
  for (const o of opts) {
    let v = 0; for (const id of want) { const c = costOf(p, id, id === p.sleeve), j = RES3.indexOf(o.k), need = c[1 + 2 * j] - p[o.k]; if (need > 0) { const all = RES3.reduce((t, k, q) => t + Math.max(0, c[1 + 2 * q] - p[k]), 0); v = Math.max(v, Math.min(need, OPT.discardGain) * 10 + (need <= OPT.discardGain && all === need ? 100 : 0) + (CARDS[id][0][1] + CARDS[id][0][3] + CARDS[id][0][5]) / 10); } }
    if (v > bv) { bv = v; best = o; }
  }
  return bv > 0 ? best : { j: best.j, k: opts.find((o) => o.k === lowestRes(p) )?.k || best.k };
}
export function discard(g, idxs, pick = null) {
  if (g.winner != null || g.pending || g.phase === 'sleeve') return null;
  // (S03 10/11, pedido de S10) en la campaña también se pueden descartar maldiciones y estados, gastando la jugada (la maldición vuelve al mazo; el estado se va)
  const list = [...new Set(idxs)].filter((i) => i >= 0 && i < g.players[g.turn].hand.length && (g.campaign || !stuck(g.players[g.turn].hand[i]))).slice(0, 3);
  if (!list.length) return null;
  const p = g.players[g.turn], cards = list.map((i) => p.hand[i]);
  let gain = null;
  if (OPT.discardGain && !g.campaign) {
    let k = null, card = null;
    if (OPT.discardPick) {
      const j = pick && list.indexOf(Number(pick.card)) >= 0 ? list.indexOf(Number(pick.card)) : -1;
      if (j >= 0) { const r = discardRes(p, cards[j]); card = cards[j]; k = r.length ? (r.includes(pick.res) ? pick.res : r[0]) : lowestRes(p); }
      else { const rest = p.hand.filter((_, i) => !list.includes(i)), a = discardAuto(p, cards, rest); card = cards[a.j]; k = a.k; }
    } else k = lowestRes(p);
    gain = { res: k, n: OPT.discardGain, card };
  }
  for (const i of list) { if (!(g.campaign && isState(p.hand[i]))) p.used.push(p.hand[i]); p.hand[i] = draw(g, p); } p.acted = true;
  if (gain) p[gain.res] += gain.n;
  return { type: 'discard', seat: g.turn, cards, ...(gain ? { gain } : {}) };
}

// Resuelve el Sabotaje: descarta la carta k del rival (como en el original, no vuelve al mazo).
export function sabotage(g, k) {
  if (g.pending?.type !== 'sabotage') return null;
  const o = g.players[1 - g.pending.seat]; if (k < 0 || k >= o.hand.length) k = 0;
  const card = o.hand[k]; o.hand[k] = draw(g, o);
  const ev = { type: 'sabotage', seat: g.pending.seat, card, index: k };
  g.pending = null; return ev;
}
export function spyDone(g) { if (g.pending?.type !== 'spy') return null; const free = !!g.pending.free; g.pending = null; return { type: 'spyDone', free }; }

// Cierra el turno: chequea victoria (como el original, primero el jugador 1) y aplica producción del siguiente.
export function endTurn(g) {
  const mine = glBegin(g);
  let ev = null; try { ev = endTurnInner(g); } finally { if (!mine && g._gl) glMark(g); }
  const gl = glEnd(g, mine); if (ev && mine) ev.golpes = gl;
  return ev;
}
function endTurnInner(g) {
  if (g.phase === 'sleeve') return null; // todavía eligiendo el As
  const no100 = !!g.campaign?.noWin100; // campaña: no se gana llegando a 100
  if (!g.dev?.noWin) for (const [i, p] of g.players.entries()) {
    if (p.castle >= 100 && !no100) { g.winner = i; return { type: 'win', winner: i, reason: 'castle100' }; }
    if (p.castle <= 0) { p.castle = 0; g.winner = 1 - i; return { type: 'win', winner: 1 - i, reason: 'castle0' }; }
  }
  if (g.campaign && !g.passed && !g.freePlay && g.players[g.turn].aimOn) { const q = g.players[g.turn], n = q.hand.filter((h) => (h === ARROW || h === ARROW + PLUS) && playable(q, h)).length; if (n && g.arrowSeen !== n) { g.arrowSeen = n; g.freePlay = true; q.arrowOnly = true; } } // Flechas en la mano: siempre las podés tirar (no gastan jugada)
  if (g.freePlay) { g.freePlay = false; g.inExtra = true; const p = g.players[g.turn]; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, free: true, left: Math.max(1, g.playsLeft || 1) }; } // Flecha del elfo: no gasta jugada
  if (g.rapidPending) { g.rapidPending = false; g.inExtra = true; g.rapidMode = true; const p = g.players[g.turn]; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, rapid: true, left: 1 }; }
  if (g.extraTurn > 0) { g.extraTurn--; g.inExtra = true; g.rapidMode = false; g.cycled = false; g.cycles = 0; const p = g.players[g.turn]; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, left: g.extraTurn + 1 }; }
  // campaña: jugadas por turno (2; la aldea sube a 3): mientras queden, el mismo jugador sigue (como el Reloj de arena, sin reiniciar los cambios)
  if (g.campaign && g.playsLeft > 1) { g.playsLeft--; g.inExtra = true; g.rapidMode = false; const p = g.players[g.turn]; p.arrowOnly = false; return { type: 'turn', seat: g.turn, before: stats(p), after: stats(p), blocked: true, extra: true, plays: true, left: g.playsLeft }; }
  g.inExtra = false; g.rapidMode = false; g.rapidUsed = 0; g.hourglass = false; g.passed = false; g.arrowSeen = null; g.players[g.turn].halfId = null; g.players[g.turn].arrowOnly = false;
  const endFx = [];
  if (g.players[g.turn].camp || g.players[1 - g.turn].poison) campBeforeEnd(g, g.players[g.turn], endFx); // Susurro venenoso
  { const q = g.players[g.turn]; if (q.keepStates > 0) q.keepStates--; else if (q.hand.some(isState)) { q.hand = q.hand.filter((id) => !isState(id)); while (q.hand.length < handSize(q)) q.hand.push(draw(g, q)); } } // campaña: los estados se van al terminar tu turno (Frasco de veneno: uno más)
  if (g.players[g.turn].discardHand) campDiscardHand(g, g.players[g.turn]); // campaña: la mano se descarta al terminar el turno (salvo Guardada y maldiciones)
  g.turn = 1 - g.turn; g.turnNo++; g.cycled = false; g.cycles = 0;
  if (OPT.cheapFrom && !g.campaign) { const T = Math.ceil(g.turnNo / 2), cut = T >= OPT.cheapFrom ? Math.min(OPT.cheapMax, OPT.cheapStep * (T - OPT.cheapFrom + 1)) : 0; for (const q of g.players) q.siegeCut = +cut.toFixed(2); } // asedio final (Juan 01/11)
  const p = g.players[g.turn], before = stats(p), both = () => [stats(g.players[0]), stats(g.players[1])], S0 = both();
  if (OPT.finalSiege && !g.campaign && g.turnNo > OPT.finalSiege) { const pc = glCtx(g, 'efecto', 'siege'); statRemove(g, p, [0, 0, 0, 0, 0, 0, 0, Math.floor((g.turnNo - OPT.finalSiege - 1) * OPT.siegeRamp) + 1], false, [], true); glRestore(g, pc); } // asedio final (opción)
  const wd = p.wounded || 0, wm = Math.min(OPT.woundedMin, 1e9), ub = wd & 1 ? wm : p.builder, ur = wd & 2 ? wm : p.recruit, um = wd & 4 ? wm : p.mage, all = ub + ur + um, healed = woundedList(p); // unidades heridas: este turno no producen
  if (!p.noProd) switch (p.statsType) {
    case 0: { const f = g.campaign ? 0 : OPT.prodFloor, pm = p.prodMul || 1; p.brick += Math.max(f, ub) * pm; p.weapon += Math.max(f, ur) * pm; p.crystal += Math.max(f, um) * pm; break; } // prodMul: Gran ejército (humano)
    case 1: p.brick += all; break;
    case 2: p.weapon += all; break;
    case 3: p.crystal += all; break;
    case 5: p.brick += ub; p.weapon += ur; p.crystal += um * 2; break;
  }
  p.wounded = 0; // ya no produjeron este turno: el que viene vuelven
  if (p.tempWall) { p.wall = Math.max(0, p.wall - p.tempWall); p.tempWall = 0; } // campaña: muro de bicho (se entierra) dura hasta su próximo turno
  if (g.campaign?.baseProd && p.statsType !== 4 && !p.noProd) { const bp = g.campaign.baseProd; p.brick += bp; p.weapon += bp; p.crystal += bp; } // campaña: producción base además de las unidades (con 1 unidad la economía no alcanza)
  if (p.race) p.favor = Math.min(FAVOR_MAX, (p.favor || 0) + 1);
  p.lastDamage = p.dmgRound; p.dmgRound = 0; const S1 = both();
  // efectos duraderos: actúan al inicio del turno de su dueño (o del afectado, si están sobre él)
  const effectsLog = [], o3 = other(g, p);
  for (const e of p.effects) {
    e.turns--; const pce = glCtx(g, 'efecto', e.e);
    switch (e.e) {
      case 'rain': statRemove(g, o3, [0, 0, 0, 0, 0, 0, 5, 0], false, []); effectsLog.push('rain'); break;
      case 'quarry': p.brick += 6; effectsLog.push('quarry'); break;
      case 'livingwall': p.wall += 5; effectsLog.push('livingwall'); break;
      case 'tithe': if (!(p.kingStun > 0)) p.kingCharge = (p.kingCharge || 0) + 1; effectsLog.push('tithe'); break; // desmayado no carga (críticos 5)
      case 'edict': if (e.turns % 2 === 0) { p.builder += 1; effectsLog.push('edict'); } break;
      case 'mines': p.brick += 3; p.wall += 1; effectsLog.push('mines'); break;
      case 'whispers': { const want = p.race === 'drow' ? Math.ceil(3 * OPT.drowMult) : 3, nv = Math.max(Math.min(o3.crystal, resFloor(g, o3, 'crystal')), o3.crystal - want), ab = Math.min(want, o3.crystal) - (o3.crystal - nv); o3.crystal = nv; p.crystal += 1; effectsLog.push('whispers'); if (p.race === 'drow' && ab > 0) { const af = []; const n = ashHit(g, o3, ab, af); if (n) effectsLog.push('ash:' + n); } break; }
      case 'nightshop': p.weapon += 3; effectsLog.push('nightshop'); break;
      case 'siegelock': effectsLog.push('siegelock'); break;
      case 'drums': effectsLog.push('drums'); break;
    }
    glRestore(g, pce);
  }
  p.effects = p.effects.filter((e) => e.turns > 0);
  if (g.campaign) { g.playsLeft = campPlays(p); if (p.camp) campTurnStart(g, p, o3, effectsLog); } // campaña: jugadas del turno, Obras
  const S2 = both();
  // el rey: si está desmayado se recupera un turno; si no, carga; al completar el período, actúa
  let king = null;
  // desmayo: este turno el rey no carga (stunTurn) y, si fue Luto, las cartas cuestan 2 más; al terminar el desmayo se va el Luto
  if (p.kingStun > 0) { p.kingStun--; p.stunTurn = true; } else { p.stunTurn = false; p.luto = false; }
  p.kingAuto = false; p.tradeTurn = false;
  if (hasKing(p)) {
    const per = kingPeriod(p);
    if (p.stunTurn) { /* desmayado: no carga */ }
    else { if (p.kingCharge >= per) { p.kingCharge = 0; king = kingAct(g, p); if (p.kingDouble) { p.kingDouble = false; const k2 = kingAct(g, p); king.mid = k2.before; king.fx2 = k2.fx || []; king.after = k2.after; king.fx = king.fx.concat(k2.fx, ['double']); if (k2.played) king.played2 = k2.played; } } else { p.kingCharge++; if (p.kingCharge >= per) { p.kingCharge = 0; king = kingAct(g, p); if (p.kingDouble) { p.kingDouble = false; const k2 = kingAct(g, p); king.mid = k2.before; king.fx2 = k2.fx || []; king.after = k2.after; king.fx = king.fx.concat(k2.fx, ['double']); if (k2.played) king.played2 = k2.played; } } } }
  }
  if (king) p.kingAuto = true; // este turno no se juega la mítica (Juan 27/10)
  if (p.spyNext) { p.spyNext = false; g.pending = { type: 'spy', seat: g.turn, free: true }; } // Red de espías: mirar no gasta el turno
  const blocked = p.statsType === 4;
  devClamp(g);
  glMark(g); if (!blocked && ((p.race === 'humano' && !p.noPassive) || p.basePassive)) { const k = ['brick', 'weapon', 'crystal'].sort((x, y) => p[x] - p[y])[0]; if (p[k] < 6) p[k] += 1; if (p.wall < 10) p.wall += 1; glMark(g, 'pasiva', 'humano'); }
  p.statsType = 0; devClamp(g);
  const ev = { type: 'turn', seat: g.turn, before, after: stats(p), blocked, king, effects: effectsLog, steps: [S0, S1, S2, both()], fx: endFx, ...(healed.length ? { woundedIdle: healed } : {}) };
  if (g.hooks) { glMark(g); for (const id of p.hand) if (FX[id]?.tick) statAdd(p, FX[id].tick); fire(g, 'onTurnStart', { seat: g.turn, ev, fx: ev.fx }); glMark(g, 'efecto', 'regla'); ev.after = stats(p); ev.steps[3] = both(); } // campaña: maldiciones que pican y reglas/equipo
  const o2 = other(g, p); if (o2.castle <= 0 || (p.castle >= 100 && !no100) || (o2.castle >= 100 && !no100) || p.castle <= 0) { if (!g.dev?.noWin) { if (o2.castle <= 0 || (p.castle >= 100 && !no100)) g.winner = g.turn; else g.winner = 1 - g.turn; } }
  return ev;
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
  if (playableSleeve(p) && (MYTHIC.has(p.sleeve) || !usable.length)) return { type: 'play', index: 'sleeve' }; // Fácil: la mítica apenas puede; otra carta, si no tiene nada
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
  const pub = (p, mine) => ({ race: p.race || null, siegeCut: p.siegeCut || 0, handCount: p.hand.length, builder: p.builder, brick: p.brick, recruit: p.recruit, weapon: p.weapon, mage: p.mage, crystal: p.crystal, wall: p.wall, castle: p.castle, noDamage: p.noDamage, x2: p.x2, statsType: p.statsType, deckCount: p.deck.length, usedCount: p.used.length, kingCharge: p.kingCharge, kingStun: p.kingStun, kingGuard: p.kingGuard, kingAuto: !!p.kingAuto, tradeTurn: !!p.tradeTurn, ...(p.devKA ? { devKA: true } : {}), favor: p.favor || 0, trap: p.trap && (mine || p.trapSeen) ? p.trap : p.trap ? 'oculta' : null, hasTrap: !!p.trap, trapSeen: !!(p.trap && p.trapSeen), effects: (p.effects || []).map((e) => ({ e: e.e, turns: e.turns, from: e.from })), lastDamage: p.lastDamage || 0, kingDouble: !!p.kingDouble, halfId: p.halfId || null, luto: !!p.luto, stunTurn: !!p.stunTurn, kingPeriod: hasKing(p) ? kingPeriod(p) : 0, handSize: handSize(p), noKing: !!p.noKing, rage: p.rage || 0, sleeve: p.sleeve != null, sleeveReady: !!(p.sleeve != null && playableSleeve(p)) /* el rival ve que podés pagar tu As, no cuál es (críticos) */, sleeveDone: p.sleeveDone !== false, acted: !!p.acted, wounded: woundedList(p), ...(p.possessed ? { possessed: true } : {}), ...(p.camp ? campView(p) : {}) });
  const me = g.players[seat], op = g.players[1 - seat];
  const reveal = g.pending && g.pending.seat === seat;
  return { seat, phase: g.phase || 'play', turn: g.turn, ...(g.campaign ? { playsLeft: g.turn === seat ? Math.max(0, g.playsLeft ?? 1) + (g.extraTurn > 0 ? g.extraTurn : 0) + (g.rapidPending ? 1 : 0) : 0 } : {}), winner: g.winner, pending: g.pending, turnNo: g.turnNo, campaign: g.campaign || null, intent: g.intent && g.intent.seat !== seat ? g.intent : null, cycled: g.cycled, cyclesLeft: g.turn === seat ? cyclesLeft(g) : 0, inExtra: !!g.inExtra, extraLeft: g.inExtra ? g.extraTurn + 1 : 0, rapid: !!g.rapidMode, races: [g.players[0].race, g.players[1].race], me: { ...pub(me, true), hand: me.hand.slice(), sleeveChoices: g.phase === 'sleeve' ? sleeveChoices(me) : null, sleeveCard: me.sleeve, sleevePlayable: g.turn === seat && playableSleeve(me), sleeveCost: me.sleeve != null ? costOf(me, me.sleeve, true) : null }, op: { ...pub(op, false), hand: reveal ? op.hand.slice() : null } };
}

// Eventos vistos desde un asiento (Juan 24/10, trampas ocultas): la trampa que arma el rival llega como carta tapada
// (card 0, hidden 'trap'); los descartes del rival ya llegaban con cartas 0 desde el servidor.
export function eventsFor(evs, seat) {
  return (evs || []).map((e) => (e && e.type === 'play' && e.seat !== seat && e.card && FX[e.card]?.k === 'trap' && !e.trapSeen ? { type: 'play', seat: e.seat, card: 0, hidden: 'trap', fx: ['trapSet'], before: e.before, after: e.after, ...(e.sleeve ? { sleeve: e.sleeve } : {}) } : e));
}
// Lo que la IA del asiento `seat` sabe: la trampa rival oculta no la conoce (sin esto la IA la esquivaba simulando la jugada)
function aiBelief(g, seat) {
  const o = g.players[1 - seat]; if (!o.trap || o.trapSeen) return g;
  const c = cloneGame(g); c.players[1 - seat].trap = null; c.players[1 - seat].trapHidden = true; return c;
}

/* ======================= IA POR NIVELES ======================= */
// Fácil = IA original (aiChoose). Normal = evalúa cada jugada. Difícil = además anticipa la mejor respuesta del rival
// muestreando manos posibles con las cartas que le quedan (no espía su mano real).

function cloneGame(g) {
  const cp = (p) => ({ ...p, deck: p.deck.slice(), used: p.used.slice(), hand: p.hand.slice(), effects: (p.effects || []).map((e) => ({ ...e })), ...(p.rs ? { rs: { ...p.rs } } : {}), ...(p.camp ? campClone(p) : {}) });
  return { ...g, players: [cp(g.players[0]), cp(g.players[1])], pending: g.pending ? { ...g.pending } : null, _noGl: true, _gl: null };
}
const clampV = (v, cap, slope) => (v <= cap ? v : cap + (v - cap) * slope);

// Valor de la posición desde el punto de vista de `seat`.
export const W = { castle: 0.8, castleHi: 7.9, castleLo: 3.9, wall: 1.63, wallCap: 29, unit: 35, unitCap: 15.8, res: 0.8, resCap: 22.6, shield: 13, x2: 20, threat: 1.52, threatK: 0.46, oppW: 2.33 }; // ajustados por búsqueda automática
export const W2 = { castle: 0.92, castleHi: 21.8, castleLo: 3.4, wall: 2.4, wallCap: 29, unit: 46.5, unitCap: 20.2, res: 0.8, resCap: 25.8, shield: 9.2, x2: 20.6, threat: 1.38, threatK: 0.7, oppW: 1.64 }; // pesos del nivel Difícil
// Pesos de la IA Difícil para valorar cómo queda la partida al final de cada simulación (arrancan iguales a W; se afinan aparte)
export const WH = { ...W };
// Pesos de la IA sobre el rey rival (14/10, para que use Luto y los desmayos cuando el rey está por actuar). Antes: { stunNear: 9, stunTurn: false, luto: false }.
export const AIW = { stunNear: 30, stunTurn: true, luto: true, lethal: true, mcDiscard: 0.03, mcTrap: 0.03, danger: 0.08, finish: 0, noDoubleProd: false };
// Trampas ocultas (Juan 24/10): el rival sabe que hay una, no cuál. drowSee: los drow ven las trampas sin carta (a medir).
export const TRAPS = { hidden: true, drowSee: true };
export function evaluate(g, seat, Wt = W) {
  const W = Wt;
  if (g.winner != null) return g.winner === seat ? 1e5 : -1e5;
  let extraBonus = 0;
  if (g.turn === seat && g.inExtra) { const p = g.players[seat], n = p.hand.filter((id) => playable(p, id)).length; extraBonus = Math.min(n, g.extraTurn + 1) * 9; }
  const me = g.players[seat], op = g.players[1 - seat];
  const side = (p, o) => {
    let v = 0;
    v += p.castle * W.castle + (p.castle >= 70 && !g.campaign?.noWin100 ? (p.castle - 70) * W.castleHi : 0) + (p.castle <= 15 ? -(15 - p.castle) * W.castleLo : 0) + (p.castle < 10 ? -(10 - p.castle) * W.castleLo : 0); // castillo en un dígito: curarlo antes que el muro (críticos 5)
    v += clampV(p.wall, W.wallCap, 0.35) * W.wall;
    if (p.minionHp > 0) v += p.minionHp * W.wall * 0.8; // campaña: el secuaz es un segundo muro (si no, la IA no le pega)
    for (const u of ['builder', 'recruit', 'mage']) v += clampV(p[u], W.unitCap, 0.5) * W.unit;
    for (const r of ['brick', 'weapon', 'crystal']) v += clampV(p[r], W.resCap, 0.3) * W.res;
    if (p.noDamage) v += W.shield;
    if (p.x2) v += W.x2;
    if (p.statsType >= 1 && p.statsType <= 3) v += 3;
    if (p.sleeve != null) v += MYTHIC.has(p.sleeve) ? 10 : 3;
    if (p.wounded) v -= woundedList(p).length * 3; // unidad herida: un turno sin producir // la carta guardada en la manga vale algo
    if (hasKing(p)) {
      const per = kingPeriod(p), ch = p.kingCharge || 0, near = ch / per; // cuanto más cerca de actuar, más vale el rey (y más duele que lo desmayen)
      v += ch * (2 + near * 4) - ((p.kingStun || 0) + (AIW.stunTurn && p.stunTurn ? 1 : 0)) * (3 + near * AIW.stunNear) + (p.kingGuard ? 2 + near * 4 : 0) + (p.kingDouble ? 6 : 0); // stunTurn: el turno de desmayo que ya corre también cuenta (si no, un desmayo de 1 turno no valía nada); desmayarlo justo antes de actuar vale mucho más
      if (AIW.luto && lutoOn(p)) v -= 4 + Math.min(8, (p.brick + p.weapon + p.crystal) / 8); // Luto: sus cartas cuestan 2 más; duele más cuanto más tiene para gastar (cartas caras)
    }
    // trampas: valen más cuando el rival tiene con qué caer en ellas
    const TV = { moat: 3 + Math.min(8, o.weapon / 3), counterspell: 3 + Math.min(8, o.crystal / 3), ambush: 3 + Math.min(6, o.weapon / 4), spynet: 4, militia: 4, irongate: 4, mirage: 3 + Math.min(6, o.weapon / 4), landmine: 3 + Math.min(8, o.weapon / 3) };
    if (g.campaign) v -= p.hand.reduce((a, id) => a + (p.pactOn ? -2 : isCurse(id) ? 8 : isState(id) ? 4 : 0) * (stuck(id) ? 1 : 0), 0); // campaña: las maldiciones en mano pesan (así la IA las mete y el jugador las saca)
    if (p.camp) v += campValue(p);
    v += (p.favor || 0) * 1.2 + (p.trap ? (TV[p.trap] || 6) : 0) + (p.effects || []).reduce((a, e) => a + (e.from != null && g.players[e.from] !== p ? -1 : 1) * e.turns * 3, 0); // efecto que le puso el rival (Asedio prolongado) resta: antes sumaba y la IA casi nunca lo jugaba (1 %)
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
    if (c.pending?.type === 'spy') { spyDone(c); bonus += 3; } // ver la mano + quemar una carta
  } else if (!discard(c, act.indexes)) return null;
  endTurn(c);
  return { g: c, bonus };
}

function candidateMoves(g) {
  const p = g.players[g.turn], moves = [];
  const oo = other(g, p), noTrap = !(oo.trap || oo.trapHidden) || oo.trapSeen; // IA (críticos 5): Ojo del vigía solo si hay trampa que ver; Trueque solo si vuelve pagable una carta
  p.hand.forEach((id, i) => { if (playable(p, id) && !(noTrap && FX[id]?.k === 'revealTrap') && !(FX[id]?.k === 'trade' && !tradePlan(p))) moves.push({ type: 'play', index: i }); });
  if (playableSleeve(p)) moves.push({ type: 'play', index: 'sleeve' });
  // descartes candidatos: la carta más difícil de pagar, y los duplicados
  const cost = (id) => { const [c] = CARDS[id]; return Math.max((c[1] - p.brick) / p.builder, (c[3] - p.weapon) / p.recruit, (c[5] - p.crystal) / p.mage, 0); };
  const order = p.hand.map((id, i) => [i, stuck(id) ? -1e9 : cost(id) + (p.hand.indexOf(id) !== i ? 3 : 0)]).sort((a, b) => b[1] - a[1]);
  if (!order.length || order[0][1] <= -1e9) return moves; // toda la mano son maldiciones/estados: solo se puede jugar (nada) → pasa
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
    const pl = pool.slice(); shuffle(pl, rnd); const nh = so.hand.length; so.hand = pl.slice(0, nh); so.deck = pl.slice(nh); so.sleeve = null; // la manga rival es secreta
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
    const pl = o.deck.concat(o.hand); shuffle(pl, rnd); const nh = o.hand.length; o.hand = pl.slice(0, nh); o.deck = pl.slice(nh); o.sleeve = null; shuffle(me.deck, rnd);
    if (o.trapHidden) { const ts = o.deck.concat(o.hand, o.used).filter((id) => FX[id]?.k === 'trap').map((id) => FX[id].t); o.trap = ts.length ? ts[Math.floor(rnd() * ts.length)] : null; } // Difícil: sabe que hay una trampa y prueba con las que puede tener su mazo
    moves.forEach((m, i) => {
      const c = cloneGame(base); c._rnd = rnd; 
      if (m.type === 'play') { if (!play(c, m.index)) { score[i] -= 1e9; return; } } else if (!discard(c, m.indexes)) { score[i] -= 1e9; return; }
      for (let t = 0; t < HARD.D && c.winner == null; t++) {
        if (c.pending?.type === 'sabotage') sabotage(c, aiSabotageSmart(c)); if (c.pending?.type === 'spy') spyDone(c);
        endTurn(c); if (c.winner != null) break;
        aiMaybeCycle(c); const a = rollPolicy(c, rnd); a.type === 'play' ? (play(c, a.index) || discard(c, [a.index])) : discard(c, a.indexes);
      }
      if (c.winner == null && !c.pending) endTurn(c);
      score[i] += c.winner != null ? (c.winner === seat ? 1 : 0) : 1 / (1 + Math.exp(-(evaluate(c, seat, WH)) / HARD.T));
    });
  }
  // Difícil (críticos 2, 26/10): no descartar si hay algo para jugar que no sea malo; armar trampas un poco más
  if (AIW.mcDiscard || AIW.mcTrap) { const hasPlay = moves.some((m) => m.type === 'play'); const p = g.players[seat], hoard = Math.max(p.brick, p.weapon, p.crystal) >= 25;
    moves.forEach((m, i) => { if (m.type === 'discard' && hasPlay) score[i] -= HARD.R * AIW.mcDiscard * (hoard ? 3 : 1); if (m.type === 'play' && m.index !== 'sleeve' && FX[p.hand[m.index]]?.k === 'trap' && !p.trap) score[i] += HARD.R * AIW.mcTrap; }); }
  // rematar con armas de sobra: rival bajo → premiar los ataques; no jugar dos "Todos producen" seguidos (críticos 4)
  if (AIW.finish || AIW.noDoubleProd) { const p = g.players[seat], o = g.players[opSeat], life = o.castle + o.wall;
    moves.forEach((m, i) => { if (m.type !== 'play' || m.index === 'sleeve') return; const id = p.hand[m.index];
      if (AIW.noDoubleProd && p.statsType >= 1 && p.statsType <= 3 && ['allWeapon', 'allCrystal', 'allBrick'].includes(SPECIAL[id])) score[i] -= HARD.R * 0.5;
      if (AIW.finish && life <= 25) { const { op } = cardVectors(g, p, o, id); const d = op[6] + op[7]; if (d > 0) score[i] += HARD.R * AIW.finish * Math.min(1, d / Math.max(1, life)); } }); }
  // en peligro (lo que tiene el rival para pegar alcanza para matarla): premiar lo que le sube muro + castillo (críticos 2: "no se defiende")
  if (AIW.danger) { const me = g.players[seat], o = g.players[opSeat], life = me.castle + me.wall, threat = Math.max(o.weapon, o.crystal, o.brick) * 1.2 + 4;
    if (life <= threat) moves.forEach((m, i) => { if (m.type !== 'play') return; const c = cloneGame(g); c._rnd = rnd; if (!play(c, m.index)) return; const q = c.players[seat], gain = q.castle + q.wall - life;
      if (gain > 0 && c.players[opSeat].castle > 0) score[i] += HARD.R * AIW.danger * Math.min(1, gain / Math.max(1, threat - life + 1)); }); }
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
  if (g.phase === 'sleeve') return { type: 'sleeve', id: (() => { const p = g.players[g.turn], c = []; for (const id of p.deck) c[id - 1] = (c[id - 1] || 0) + 1; for (let i = 0; i < c.length; i++) c[i] = c[i] || 0; return aiSleevePick(c); })() };
  // campaña: si hay una intención anunciada para este turno y la carta sigue en la mano y se puede pagar, la cumple
  if (g.intent && g.intent.seat === g.turn) { const it = g.intent; g.intent = null; if (it.turnNo === g.turnNo && it.type === 'play') { const p = g.players[g.turn], i = p.hand.indexOf(it.card); if (i >= 0 && playable(p, it.card)) return { type: 'play', index: i, intent: true }; } }
  { const p = g.players[g.turn]; if (p.forceAttack) { let bi = -1, bd = 0; p.hand.forEach((id, i) => { if (!playable(p, id)) return; const { op } = cardVectors(g, p, other(g, p), id); const d = op[6] + op[7]; if (d > bd) { bd = d; bi = i; } }); if (bi >= 0) return { type: 'play', index: bi, forced: true }; } } // regla de jefe: este turno va con su mejor ataque
  { const p = g.players[g.turn]; if ((p.pattern || p.weights) && g.campaign) return bugChoose(g); } // bichos de campaña: su acción del patrón
  if (level === 'facil') return aiChoose(g);
  g = aiBelief(g, g.turn); // la trampa rival oculta no la conoce
  // rematar: si una jugada gana ya, esa (críticos 2, 26/10: "no remata")
  if (AIW.lethal) for (const m of candidateMoves(g)) if (m.type === 'play') { const r = simulate(g, m, rnd); if (r && r.g.winner === g.turn) return m; }
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
        const pl = pool.slice(); shuffle(pl, rnd); const nh = so.hand.length; so.hand = pl.slice(0, nh); so.deck = pl.slice(nh); so.sleeve = null;
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

// Trueque (187, Juan 28/10): 1 a 1 hasta TRADE_CAP entre ladrillos, armas y cristales; cuesta 2 del recurso que entregás (sin descuentos);
// no toca el recurso de raza; ese turno no se juega el As. choice = { give, get, n } (jugador); sin choice, tradePlan (IA) o el de sobra → el que menos tenés.
export const TRADE_CAP = 6;
export function tradeResolve(p, ch) {
  if (ch && RES3.includes(ch.give) && RES3.includes(ch.get) && ch.give !== ch.get) { const n = Math.min(TRADE_CAP, Math.floor(+ch.n || 0), (p[ch.give] || 0) - 2); if (n >= 1) return { give: ch.give, get: ch.get, n }; }
  const t = tradePlan(p); if (t) return { give: t.a, get: t.b, n: t.n };
  const by = RES3.slice().sort((x, y) => p[y] - p[x]), n = Math.min(TRADE_CAP, (p[by[0]] || 0) - 2); return n >= 1 ? { give: by[0], get: by[2], n } : null;
}
// el cambio que vuelve pagable la carta más cara de la mano que hoy no se puede pagar (le falta un solo recurso)
export function tradePlan(p) {
  const R = RES3; let best = null;
  for (const id of p.hand) { if (id == null || FX[id]?.k === 'trade' || stuck(id) || playable(p, id)) continue; const c = costOf(p, id); if (c[8] && (p.favor || 0) < c[8]) continue;
    const need = R.map((k, j) => Math.max(0, c[1 + 2 * j] - p[k])); if (need.filter((x) => x > 0).length !== 1) continue;
    const bj = need.findIndex((x) => x > 0), n = need[bj]; if (n > TRADE_CAP) continue;
    for (let aj = 0; aj < 3; aj++) { if (aj === bj || p[R[aj]] - 2 - n < c[1 + 2 * aj]) continue; const q = { ...p, [R[aj]]: p[R[aj]] - 2 - n, [R[bj]]: p[R[bj]] + n }; if (!playable(q, id)) continue; const v = c[1] + c[3] + c[5]; if (!best || v > best.v) best = { a: R[aj], b: R[bj], n, v, id }; }
  }
  return best;
}

/* ---------- Bichos de campaña (S03 01/11, docs/campaña/enemigos.md): acciones de costo 0 con patrón ---------- */
// p.pattern = [ids] (orden fijo, vuelve a empezar) o p.weights = { id: peso } (al azar). La próxima acción queda elegida en p.rs.next
// apenas juega la anterior (así la intención y la jugada real coinciden). Una acción con `then` obliga la siguiente (cava → emerge).
export function bugNext(g, p) {
  if (p.rs.next != null) return p.rs.next;
  let id;
  if (p.rs.then != null) { id = p.rs.then; p.rs.then = null; }
  else if (p.pattern) { const i = p.rs.pi || 0, L = p.pattern.length, lp = Math.min(p.patternLoop || 0, L - 1); id = p.pattern[i < L ? i : lp + ((i - lp) % (L - lp))]; } // patternLoop: desde qué acción repite (Sectarios: rezan una sola vez)
  else { const ent = Object.entries(p.weights), tot = ent.reduce((a, [, w]) => a + w, 0); let q = g._rnd() * tot; id = +ent[ent.length - 1][0]; for (const [k, w] of ent) { if ((q -= w) < 0) { id = +k; break; } } }
  p.rs.next = id; return id;
}
function bugAdvance(g, p) { const done = p.rs.next; p.rs.next = null; if (p.pattern) p.rs.pi = (p.rs.pi || 0) + 1; if (done != null && FX[done]?.then) p.rs.then = FX[done].then; bugNext(g, p); }
function bugChoose(g) {
  const p = g.players[g.turn], id = bugNext(g, p); let i = p.hand.indexOf(id);
  if (i < 0) { i = p.hand.findIndex((h) => !stuck(h)); if (i < 0) { p.hand.push(id); i = p.hand.length - 1; } else p.hand[i] = id; }
  return { type: 'play', index: i };
}

// Etiquetas de la carta (críticos 4-5): las mismas condiciones que usan las trampas, para mostrarlas en la carta y en el registro.
// flecha (Espejismo), cuerpo (Foso y Mina), hechizo (Contrahechizo), maquina (máquinas gnomas). Una carta puede tener varias.
export function cardTags(id) {
  const t = [], [c, , o] = CARDS[id] || [[], [], []], k = FX[id]?.k;
  if (ARROW_IDS.has(id)) t.push('flecha');
  if (MELEE_IDS.has(id)) t.push('cuerpo');
  if (c[5] > 0 && k !== 'kingAttack' && (o.some((v) => v > 0) || ['stunKing', 'drainKing', 'luto', 'usurp'].includes(k))) t.push('hechizo');
  if (GNOME_MACHINES.includes(id)) t.push('maquina');
  return t;
}
