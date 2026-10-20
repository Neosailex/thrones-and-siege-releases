// Campaña roguelike: datos de enemigos (mazos, IA, reglas de jefe), mazo inicial del jugador, reglas → hooks e intención de la IA.
// Motor puro: lo usa el cliente (client/src/campaign/, S10) y tools/balance/camp.mjs. No toca el PvP.
import { CARDS, NAMES, FX, NCARDS_ALL, KINGS } from './cards.js';
import * as E from './engine.js';

/* ---------- mazos: {id: cantidad} → array de cantidades (largo NCARDS_ALL) ---------- */
export function deckOf(map) { const d = new Array(NCARDS_ALL).fill(0); for (const [id, n] of Object.entries(map)) d[+id - 1] = n; return d; }
export const deckSize = (d) => d.reduce((a, b) => a + b, 0);

// Parámetros del modo campaña: baseProd = recursos que producen los dos lados por turno además de sus unidades
export const CAMPAIGN = { baseProd: 2 };

/* ---------- mazo inicial del jugador (campaña): humano, 15 cartas ---------- */
// ~10 de la raza/simples + 5 neutrales. Pensado para 1 unidad de cada y recursos base 8 (ver PLAYER_START).
export const STARTER_DECKS = {
  humano: deckOf({ 2: 2, 6: 2, 8: 1, 37: 1, 60: 1, 54: 1, 34: 2, 36: 1, 30: 1, 62: 1, 63: 1, 64: 1 }),
};
// Mazo de referencia a mitad de run (solo para medir el balance de Lor/Rey: el inicial + 5 recompensas típicas)
export const MIDRUN_DECKS = { humano: deckOf({ 2: 2, 6: 2, 8: 2, 37: 1, 60: 1, 54: 1, 34: 2, 36: 1, 30: 1, 62: 1, 63: 1, 64: 1, 68: 1, 11: 1, 50: 1, 131: 1 }) };
// Estado base del jugador al empezar la campaña (la aldea lo sube). castle/wall se pisan con lo que arrastra la run.
export const PLAYER_START = { hand: 3, res: { builder: 1, recruit: 1, mage: 1, brick: 8, weapon: 8, crystal: 8, wall: 15, castle: 30 } };

/* ---------- reglas de jefe / equipo (datos) → hooks del motor ---------- */
// Cada regla es { k, ...params }. ruleHooks(rules) devuelve el objeto de hooks que entiende newGame({ seats:[{hooks}] }).
// Las reglas guardan su estado en p.rs (se clona en las simulaciones de la IA). Avisan en info.fx con 'rule:<k>' para la UI.
export const RULES = {
  // +N de cada recurso al empezar la pelea (Aldric)
  startRes: { text: (r) => `Arranca con +${r.amount} de cada recurso`, onBattleStart(g, me, r) { const p = g.players[me]; p.brick += r.amount; p.weapon += r.amount; p.crystal += r.amount; } },
  // Diezmo (Lor humano): cada N turnos propios, el rival pierde `amount` de cada recurso, sin bajar de `min`
  tithe: { text: (r) => `Cada ${r.every} turnos te saca ${r.amount} de cada recurso (no te deja con menos de ${r.min ?? 0})`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me], o = g.players[1 - me]; p.rs.tithe = (p.rs.tithe || 0) + 1; if (p.rs.tithe % r.every) return; let took = 0; for (const k of ['brick', 'weapon', 'crystal']) { const v = Math.max(r.min ?? 0, o[k] - r.amount); took += o[k] - v; o[k] = v; } if (took) info.fx.push('rule:tithe'); } },
  // Ataque grande cada N turnos (T3): ese turno la IA juega su mejor ataque
  bigHit: { text: (r) => `Cada ${r.every} turnos lanza su mejor ataque`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.big = (p.rs.big || 0) + 1; p.forceAttack = p.rs.big % r.every === 0; if (p.forceAttack) info.fx.push('rule:bigHit'); } },
  // Muro que se regenera (Lor enano)
  regenWall: { text: (r) => `Su muro se regenera +${r.amount} por turno`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; g.players[me].wall += r.amount; info.fx.push('rule:regenWall'); } },
  // Furia (Lor orco): cada ataque que recibe le suma +amount a su próximo ataque
  enrage: { text: (r) => `Cada ataque tuyo le suma +${r.amount} a su próximo ataque`, onCardPlayed(g, me, r, info) { if (info.seat === me || !info.attack) return; const p = g.players[me]; p.rage = (p.rage || 0) + r.amount; info.fx.push('rule:enrage'); } },
  // Castillo bajo pega más (Gorrak)
  lowCastleBonus: { text: (r) => `Con castillo por debajo de ${r.below}, sus ataques hacen +${r.amount}`, onBattleStart(g, me, r) { g.players[me].lowCastleBonus = { below: r.below, amount: r.amount }; } },
  // Te mete una maldición/estado cada N turnos (Lor drow, cultistas)
  curseEvery: { text: (r) => `Cada ${r.every} turnos te mete ${NAMES[r.id][0]}`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.curse = (p.rs.curse || 0) + 1; if (p.rs.curse % r.every) return; E.giveCard(g, g.players[1 - me], r.id); info.fx.push('curse:' + r.id); } },
  // Encarece las cartas del rival de un recurso (Lor elfo: cristales +2). res: 1 ladrillos, 3 armas, 5 cristales
  costUp: { text: (r) => `Tus cartas de ${{ 1: 'ladrillos', 3: 'armas', 5: 'cristales' }[r.res]} cuestan ${r.amount} más`, onBattleStart(g, me, r) { const o = g.players[1 - me]; o.costMod = o.costMod || [0, 0, 0, 0, 0, 0, 0, 0]; o.costMod[r.res] += r.amount; } },
  // Empieza con una trampa armada (Lor gnomo)
  startTrap: { text: (r) => 'Empieza con una trampa armada', onBattleStart(g, me, r) { g.players[me].trap = r.trap; } },
  // Su rey actúa más seguido (Thorgrim cada 3): se pasa por kingPeriod en el asiento, acá solo texto
  kingPeriod: { text: (r) => `Su rey actúa cada ${r.period} turnos`, onBattleStart(g, me, r) { g.players[me].kingPeriod = r.period; } },
  // Equipo del jugador: +N de una unidad / muro / castillo al empezar cada pelea (Yelmo del constructor, cabra enana…)
  startStat: { text: (r) => `Al empezar cada pelea: ${r.stat} +${r.amount}`, onBattleStart(g, me, r) { g.players[me][r.stat] += r.amount; } },
  // Equipo: el rey arranca con carga (Anillo de carga)
  startCharge: { text: (r) => `Tu rey arranca con ${r.amount} de carga`, onBattleStart(g, me, r) { g.players[me].kingCharge += r.amount; } },
  // Equipo: el primer ataque rival de la pelea falla (Capa de sombras)
  firstShield: { text: () => 'El primer ataque rival de la pelea falla', onBattleStart(g, me) { g.players[me].noDamage = true; } },
};
export const ruleText = (r) => RULES[r.k]?.text(r) ?? r.k;
export function ruleHooks(rules = []) {
  const h = {};
  for (const name of ['onBattleStart', 'onTurnStart', 'onCardPlayed', 'onDamage', 'onKingAct']) {
    const rs = rules.filter((r) => typeof RULES[r.k]?.[name] === 'function'); if (!rs.length) continue;
    h[name] = (g, me, info) => { for (const r of rs) RULES[r.k][name](g, me, r, info); };
  }
  return h;
}

/* ---------- enemigos de campaña: por raza y tier (T1 campamento, T2 guarnición, T3 élite, lor, rey) ---------- */
// { name, race, king, ai: 'facil'|'normal'|'dificil', hand, res, deck, rules }. Los mazos usan cartas normales + cartas de bicho (196-199).
const U = (bu, so, ma, b, w, cr, wall, castle) => ({ builder: bu, recruit: so, mage: ma, brick: b, weapon: w, crystal: cr, wall, castle });
export const ENEMIES = {
  humano: {
    t1: { name: 'Campamento rebelde', tier: 1, race: null, king: false, ai: 'facil', hand: 3, res: U(1, 2, 1, 4, 6, 2, 10, 35),
      deck: deckOf({ 196: 4, 1: 3, 2: 3, 6: 2, 34: 1 }), rules: [] },
    t2: { name: 'Guarnición del valle', tier: 2, race: null, king: false, ai: 'normal', hand: 3, res: U(1, 2, 1, 6, 6, 4, 15, 35),
      deck: deckOf({ 197: 4, 2: 3, 6: 3, 34: 1, 36: 1, 11: 1 }), rules: [] },
    t3: { name: 'Fortaleza de caballeros', tier: 3, race: null, king: false, ai: 'normal', hand: 3, res: U(1, 2, 1, 6, 8, 4, 25, 50),
      deck: deckOf({ 198: 2, 8: 1, 2: 3, 6: 2, 34: 1, 36: 1, 10: 1, 64: 1 }), rules: [{ k: 'bigHit', every: 2 }] },
    lor: { name: 'Lor Edmund, el Recaudador', tier: 4, race: 'humano', king: false, ai: 'normal', hand: 3, res: U(2, 1, 2, 8, 8, 6, 20, 40),
      deck: deckOf({ 62: 2, 63: 2, 64: 1, 69: 2, 8: 1, 37: 1, 50: 1, 6: 2, 11: 1, 36: 2, 199: 2 }), rules: [{ k: 'tithe', every: 3, amount: 2, min: 2 }] },
    rey: { name: 'Rey Aldric', tier: 5, race: 'humano', king: true, ai: 'dificil', hand: 4, res: U(2, 2, 2, 6, 6, 6, 20, 50),
      deck: deckOf({ 8: 2, 37: 1, 50: 1, 60: 1, 6: 2, 2: 2, 62: 1, 63: 1, 66: 1, 36: 1, 11: 1, 68: 1, 69: 1 }), rules: [{ k: 'startRes', amount: 4 }] },
  },
};
export const BOSS_LOOT = { humano: [200, 201] };

/* ---------- armar una pelea ---------- */
// player = { deck, hand, res, race, rules (equipo), king }; enemy = una entrada de ENEMIES. Devuelve el juego; el jugador es el asiento 0, el enemigo el 1.
export function makeBattle(player, enemy, { starter = 0, rnd = Math.random } = {}) {
  const pr = player.rules || [], er = enemy.rules || [];
  const g = E.newGame({
    starter, rnd, campaign: { noWin100: true, baseProd: CAMPAIGN.baseProd },
    seats: [
      { deck: player.deck, hand: player.hand ?? PLAYER_START.hand, res: { ...PLAYER_START.res, ...(player.res || {}) }, race: player.race || 'humano', king: player.king !== false, hooks: ruleHooks(pr), rules: pr },
      { deck: enemy.deck, hand: enemy.hand, res: enemy.res, race: enemy.race, king: !!enemy.king, hooks: ruleHooks(er), rules: er },
    ],
  });
  g.enemy = { name: enemy.name, tier: enemy.tier, ai: enemy.ai, rules: er.map((r) => ({ ...r, text: ruleText(r) })) };
  return g;
}

/* ---------- intención: qué va a hacer la IA en su próximo turno, sin ejecutarlo ---------- */
// Se llama cuando le toca al jugador (g.turn = jugador). Simula "el jugador pasa" en una copia, deja que la IA elija y devuelve
// { seat, turnNo, type:'play'|'discard'|'pass', card, name, kind:'attack'|'wall'|'castle'|'build'|'units'|'trap'|'effect'|'other', dmg, direct, wall, castle, text }.
// También lo guarda en g.intent: cuando le toque, aiChooseLevel cumple esa jugada si la carta sigue en su mano y la puede pagar
// (si no, elige de nuevo y la UI ve `intent: false` en la jugada). viewFor(g, seat) incluye `intent` para el rival.
export function aiIntent(g, level = 'normal', rnd = Math.random) {
  if (g.winner != null) return null;
  const enemy = 1 - g.turn, c = cloneForIntent(g); c._rnd = rnd;
  if (c.pending) c.pending = null; c.inExtra = false; c.extraTurn = 0; c.rapidPending = false;
  E.endTurn(c); if (c.winner != null || c.turn !== enemy) return null;
  const p = c.players[enemy], o = c.players[1 - enemy];
  E.aiMaybeCycle(c);
  const m = E.aiChooseLevel(c, level, rnd);
  const it = { seat: enemy, turnNo: c.turnNo, type: m.type, card: null, name: null, kind: 'other', dmg: 0, direct: 0, wall: 0, castle: 0, text: 'Descarta' };
  if (m.type === 'play') {
    const id = p.hand[m.index]; it.card = id; it.name = NAMES[id][0];
    const { s, op } = E.cardVectors(c, p, o, id);
    it.dmg = op[6]; it.direct = op[7]; it.wall = s[6]; it.castle = s[7];
    const k = FX[id]?.k;
    if (op[6] + op[7] > 0) { it.kind = 'attack'; it.text = op[7] ? `Ataca ${op[6] + op[7]} (${op[7]} directo)` : `Ataca ${op[6]}`; }
    else if (k === 'trap') { it.kind = 'trap'; it.text = 'Arma una trampa'; }
    else if (k === 'giveCurse') { it.kind = 'curse'; it.text = 'Te maldice'; }
    else if (k === 'effect') { it.kind = 'effect'; it.text = 'Lanza un efecto'; }
    else if (s[6] > 0 && s[7] > 0) { it.kind = 'castle'; it.text = `Castillo +${s[7]}, muro +${s[6]}`; }
    else if (s[7] > 0) { it.kind = 'castle'; it.text = `Castillo +${s[7]}`; }
    else if (s[6] > 0) { it.kind = 'wall'; it.text = `Muro +${s[6]}`; }
    else if (s[0] + s[2] + s[4] > 0) { it.kind = 'units'; it.text = 'Recluta'; }
    else if (op.slice(0, 6).some((v) => v > 0)) { it.kind = 'steal'; it.text = 'Te saca recursos'; }
    else if (s.slice(0, 6).some((v) => v > 0)) { it.kind = 'build'; it.text = 'Junta recursos'; }
  }
  if (g.players[g.turn].hand.includes(195)) it.hidden = true; // estado Humo: la UI no la muestra (la IA igual la cumple)
  g.intent = it;
  return it;
}
function cloneForIntent(g) {
  const cp = (p) => ({ ...p, deck: p.deck.slice(), used: p.used.slice(), hand: p.hand.slice(), effects: (p.effects || []).map((e) => ({ ...e })), rs: p.rs ? { ...p.rs } : undefined });
  return { ...g, players: [cp(g.players[0]), cp(g.players[1])], pending: null, intent: null, _noGl: true, _gl: null };
}
