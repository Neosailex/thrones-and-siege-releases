// Campaña roguelike: datos de enemigos (mazos, IA, reglas de jefe), mazo inicial del jugador, reglas → hooks e intención de la IA.
// Motor puro: lo usa el cliente (client/src/campaign/, S10) y tools/balance/camp.mjs. No toca el PvP.
import { CARDS, NAMES, FX, NCARDS_ALL, KINGS } from './cards.js';
import * as E from './engine.js';

/* ---------- mazos: {id: cantidad} → array de cantidades (largo NCARDS_ALL) ---------- */
export function deckOf(map) { const d = new Array(NCARDS_ALL).fill(0); for (const [id, n] of Object.entries(map)) d[+id - 1] = n; return d; }
export const deckSize = (d) => d.reduce((a, b) => a + b, 0);

// Parámetros del modo campaña: baseProd = recursos que producen los dos lados por turno además de sus unidades
// plays = jugadas por turno del jugador (Juan 25/10: 2; el Salón de guerra de la aldea lo sube a 3); los enemigos juegan 1 (enemy.plays lo cambia).
// discardHand = la mano del jugador se descarta al terminar su turno (salvo Guardada y maldiciones), como en Slay the Spire.
export const CAMPAIGN = { baseProd: 2, plays: 2, discardHand: true };

/* ---------- mazo inicial del jugador (campaña): humano, 15 cartas ---------- */
// ~10 de la raza/simples + 5 neutrales. Pensado para 1 unidad de cada y recursos base 8 (ver PLAYER_START).
export const STARTER_DECKS = {
  humano: deckOf({ 2: 2, 6: 2, 8: 1, 37: 1, 60: 1, 54: 1, 34: 2, 36: 1, 30: 1, 62: 1, 63: 1, 64: 1 }),
};
// Mazo de referencia a mitad de run (solo para medir el balance de Lor/Rey: el inicial + 5 recompensas típicas)
// (25/10) con las cartas nuevas de campaña: el inicial + Arqueros, Catedral, Estandarte del reino, Mercenarios, Veterano, Reconstrucción mayor; ~60 de oro a esta altura
export const MIDRUN_DECKS = { humano: deckOf({ 2: 2, 6: 2, 8: 2, 37: 1, 60: 1, 54: 1, 34: 2, 36: 1, 30: 1, 62: 1, 63: 1, 64: 1, 68: 1, 216: 1, 210: 1, 270: 1, 277: 1 }) };
export const MIDRUN_GOLD = 60;
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
  /* ---- equipo que rompe reglas (cartas.md §5, Juan 25/10) ---- */
  wallGloves: { name: 'Guantes de albañil', rar: 'comun', text: () => 'Cada vez que jugás una carta que te sube el muro, daño 2', onBattleStart(g, me) { g.players[me].wallGloves = true; } },
  goldBag: { name: 'Bolsa agujereada', rar: 'comun', goldMul: 1.3, villageMul: 0.9, text: () => '+30 % de oro, pero 10 % menos de recursos de aldea' },
  warHorn: { name: 'Cuerno de batalla', rar: 'comun', text: () => 'La primera carta de cada pelea cuesta 0', onBattleStart(g, me) { g.players[me].firstFree = true; } },
  leafTalisman: { name: 'Talismán de hoja', rar: 'comun', text: () => 'La primera Rápida de cada turno es gratis', onBattleStart(g, me) { g.players[me].rapidFree = true; } },
  eternalGear: { name: 'Engranaje eterno', rar: 'raro', race: 'gnomo', keepWorks: true, text: () => 'Tus Obras empiezan cada pelea ya construidas si la pelea anterior terminó con ellas' },
  bloodCup: { name: 'Copa de sangre', rar: 'raro', race: 'orco', text: () => 'Cada vez que perdés castillo por una carta tuya, armas +2', onBattleStart(g, me) { g.players[me].bloodCup = true; } },
  forestMantle: { name: 'Manto del bosque', rar: 'raro', race: 'elfo', text: () => 'Cambiar cartas no tiene límite, pero desde el 4.º cambio del turno cada uno cuesta 1 cristal', onBattleStart(g, me) { g.players[me].mantle = true; } },
  poisonVial: { name: 'Frasco de veneno', rar: 'raro', race: 'drow', text: () => 'Los estados que le metés al rival duran un turno más', onBattleStart(g, me) { g.players[me].poisonVial = true; } },
  treasurerBag: { name: 'Bolsa del tesorero', rar: 'raro', race: 'humano', keepGoldOnDeath: 0.5, text: () => 'Si morís, el 50 % del oro de la run vuelve a la aldea como Oro' },
  runicAnvil: { name: 'Yunque rúnico', rar: 'raro', race: 'enano', noWallCap: true, text: () => 'El muro que te llevás entre peleas no tiene tope' },
  warCrown: { name: 'Corona de guerra', rar: 'jefe', plays: 1, hand: -1, text: () => '+1 jugada por turno, pero tu mano es 1 menos' },
  stolenThrone: { name: 'Trono robado', rar: 'jefe', text: () => 'Tu rey actúa cada 3 turnos, pero arranca desmayado 2 turnos en cada pelea', onBattleStart(g, me) { const p = g.players[me]; p.kingPeriod = 3; p.kingStun = Math.max(p.kingStun || 0, 2); } },
  demonChalice: { name: 'Cáliz del demonio', rar: 'jefe', text: () => '+5 de cada recurso al empezar cada pelea; cada pelea empieza con una Plaga de ratas en tu mano', onBattleStart(g, me) { const p = g.players[me]; p.brick += 5; p.weapon += 5; p.crystal += 5; E.giveCard(g, p, 190); } },
  cartographer: { name: 'Mapa del cartógrafo', rar: 'jefe', seeMap: true, noCampfire: true, text: () => 'Ves todo el mapa y los enemigos de cada nodo; no hay fogatas en la run' },
  watcherEye: { name: 'Ojo del vigía', rar: 'jefe', hand: -1, text: () => 'Ves siempre la trampa y la jugada exacta del enemigo; tu mano es 1 menos', onBattleStart(g, me) { const p = g.players[me]; p.seeTraps = true; p.seeIntentAlways = true; const o = g.players[1 - me]; if (o.trap) o.trapSeen = true; } },
};
// Equipo nuevo (cartas.md §5): ids de regla → se pasan en player.rules como { k: 'wallGloves' } etc. EQUIP_RULES lista los 15 con nombre y rareza.
export const EQUIP_RULES = ['wallGloves', 'goldBag', 'warHorn', 'leafTalisman', 'eternalGear', 'bloodCup', 'forestMantle', 'poisonVial', 'treasurerBag', 'runicAnvil', 'warCrown', 'stolenThrone', 'demonChalice', 'cartographer', 'watcherEye'];
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
    // (25/10, campaña con 2 jugadas por turno) plays = jugadas por turno del enemigo (1,5 = una y dos alternadas). Antes → ahora en docs/campaña/cartas.md
    t1: { name: 'Campamento rebelde', tier: 1, race: null, king: false, ai: 'facil', hand: 3, plays: 1, res: U(1, 2, 1, 4, 6, 2, 10, 35),
      deck: deckOf({ 196: 4, 1: 3, 2: 3, 6: 2, 34: 1 }), rules: [] },
    t2: { name: 'Guarnición del valle', tier: 2, race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 1, 6, 10, 4, 20, 45),
      deck: deckOf({ 197: 4, 2: 3, 6: 3, 8: 1, 34: 1, 36: 1, 11: 1 }), rules: [] },
    t3: { name: 'Fortaleza de caballeros', tier: 3, race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 1, 6, 12, 4, 30, 60),
      deck: deckOf({ 198: 4, 8: 3, 37: 2, 6: 3, 34: 1, 36: 1, 60: 1 }), rules: [{ k: 'bigHit', every: 2 }] },
    lor: { name: 'Lor Edmund, el Recaudador', tier: 4, race: 'humano', king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(2, 1, 2, 8, 8, 6, 25, 55),
      deck: deckOf({ 8: 2, 37: 2, 50: 1, 60: 2, 6: 2, 199: 2, 69: 2, 36: 1, 11: 1 }), rules: [{ k: 'tithe', every: 4, amount: 2, min: 2 }] },
    rey: { name: 'Rey Aldric', tier: 5, race: 'humano', king: true, ai: 'dificil', hand: 4, plays: 1.5, res: U(2, 2, 2, 6, 6, 6, 20, 50),
      deck: deckOf({ 8: 2, 37: 1, 50: 1, 60: 1, 6: 2, 2: 2, 62: 1, 63: 1, 66: 1, 36: 1, 11: 1, 68: 1, 69: 1 }), rules: [{ k: 'startRes', amount: 8 }] },
  },
};
export const BOSS_LOOT = { humano: [200, 201] };

/* ---------- armar una pelea ---------- */
// player = { deck, hand, res, race, rules (equipo), king }; enemy = una entrada de ENEMIES. Devuelve el juego; el jugador es el asiento 0, el enemigo el 1.
// Además (25/10): player.plays (jugadas por turno, por defecto CAMPAIGN.plays; el Salón de guerra suma), player.gold (oro de la run), player.kills
// (enemigos vencidos en la run: Banquete), player.grow ({ id: n } lo que ya creció cada carta "Crece"), player.works (ids de Obras que
// quedaron de la pelea anterior: solo con Engranaje eterno), player.maxCastle (vida máxima: Berserker de sangre).
export function makeBattle(player, enemy, { starter = 0, rnd = Math.random } = {}) {
  const pr = player.rules || [], er = enemy.rules || [];
  const sum = (k) => pr.reduce((a, r) => a + (RULES[r.k]?.[k] || 0), 0); // equipo que cambia jugadas/mano (Corona de guerra, Ojo del vigía)
  const keepWorks = pr.some((r) => RULES[r.k]?.keepWorks);
  const g = E.newGame({
    starter, rnd, campaign: { noWin100: true, baseProd: CAMPAIGN.baseProd },
    seats: [
      { deck: player.deck, hand: Math.max(1, (player.hand ?? PLAYER_START.hand) + sum('hand')), res: { ...PLAYER_START.res, ...(player.res || {}) }, race: player.race || 'humano', king: player.king !== false, hooks: ruleHooks(pr), rules: pr,
        plays: (player.plays ?? CAMPAIGN.plays) + sum('plays'), discardHand: player.discardHand ?? CAMPAIGN.discardHand, gold: player.gold || 0, kills: player.kills || 0, grow: player.grow || {}, works: keepWorks ? player.works || [] : [], maxCastle: player.maxCastle ?? player.res?.castle ?? PLAYER_START.res.castle },
      { deck: enemy.deck, hand: enemy.hand, res: enemy.res, race: enemy.race, king: !!enemy.king, hooks: ruleHooks(er), rules: er, plays: enemy.plays || 1, discardHand: !!enemy.discardHand },
    ],
  });
  g.enemy = { name: enemy.name, tier: enemy.tier, ai: enemy.ai, rules: er.map((r) => ({ ...r, text: ruleText(r) })) }; g.rules = [pr, er];
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
  if (c.pending) c.pending = null; c.inExtra = false; c.extraTurn = 0; c.rapidPending = false; c.playsLeft = 0; // el jugador pasa (aunque le queden jugadas)
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
  { const pl = g.players[g.turn]; if (pl.hand.includes(195)) { if (pl.seeIntentAlways) {} else if (pl.seeIntent > 0) pl.seeIntent--; else it.hidden = true; } } // estado Humo: la UI no la muestra (la IA igual la cumple); Espía de la corte / Ojo del vigía la dejan ver
  g.intent = it;
  return it;
}
function cloneForIntent(g) {
  const cp = (p) => ({ ...p, deck: p.deck.slice(), used: p.used.slice(), hand: p.hand.slice(), effects: (p.effects || []).map((e) => ({ ...e })), rs: p.rs ? { ...p.rs } : undefined, works: (p.works || []).map((w) => ({ ...w })), burned: (p.burned || []).slice(), grown: { ...(p.grown || {}) } });
  return { ...g, players: [cp(g.players[0]), cp(g.players[1])], pending: null, intent: null, _noGl: true, _gl: null };
}

/* ---------- resultado de una pelea (25/10): lo que S10 guarda en la run ---------- */
// battleResult(g) → { win, castle, wall, gold (oro de la run al terminar, con los +oro de fin de pelea y la Bolsa agujereada), goldGained,
//   grown: { id: cuánto creció en ESTA pelea } (sumarlo a run.grow), works: [ids] (Obras en pie: para Engranaje eterno),
//   burned: [ids] (cartas quemadas: vuelven en la próxima pelea), kills: 1 si ganó }.
// Las cartas "Crece" de fin de pelea (Banco de la corona, Tesoro creciente, Piedra viva) y el oro de Arca vacía se aplican acá, una vez por tipo de carta.
export function battleResult(g, seat = 0) {
  const p = g.players[seat], grown = { ...(p.grown || {}) }, pp = { gold: p.gold || 0, wall: p.wall };
  const owned = new Set([...p.deck, ...p.hand, ...p.used, ...(p.burned || [])]);
  for (const id of owned) { const end = FX[id]?.camp?.end; if (end) end({ p: pp, id, plus: !!FX[id].plus, grow: (gid, n = 1) => { grown[gid] = (grown[gid] || 0) + n; } }); }
  const mul = (g.rules?.[seat] || []).reduce((m, r) => m * (RULES[r.k]?.goldMul || 1), 1);
  const gained = pp.gold - (p.goldStart || 0), gold = (p.goldStart || 0) + Math.round(gained * (gained > 0 ? mul : 1));
  return { win: g.winner === seat, castle: p.castle, wall: p.wall, gold, goldGained: gold - (p.goldStart || 0), grown, works: (p.works || []).map((w) => w.id), burned: (p.burned || []).slice(), kills: g.winner === seat ? 1 : 0 };
}
// Para S10: la versión + de una carta (fogata, eventos, dorada) y sus datos de recompensa
export { CAMP_INFO, CAMP_IDS, PLUS, plusOf, baseOf, isPlus, hasPlus } from './campaign-cards.js';
