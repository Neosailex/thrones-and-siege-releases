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
  curseEvery: { text: (r) => `${r.every > 1 ? `Cada ${r.every} turnos` : 'Cada turno'} te mete ${NAMES[r.id][0]}`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.curse = (p.rs.curse || 0) + 1; if (p.rs.curse % r.every) return; E.giveCard(g, g.players[1 - me], r.id); info.fx.push('curse:' + r.id); } },
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
  /* ---- reyes poseídos y Grieta (Juan 27/10, diseño §7b) ---- */
  // Fase demoníaca: cuando el castillo baja a `at` (0,5 = la mitad de con lo que arrancó), el demonio lo posee: fx 'possessed' (UI: cinemática)
  // y desde ahí corren las reglas de `rules` (su "carta demoníaca"). En la vista: view.op.possessed = true.
  possess: { text: (r) => `A media vida, el demonio lo posee: ${(r.rules || []).map((x) => ruleText(x)).join('; ')}`,
    onBattleStart(g, me, r) { g.players[me].rs.castle0 = g.players[me].castle; },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.possessed || p.castle <= 0) return; if (p.castle > Math.ceil((p.rs.castle0 || p.castle) * (r.at ?? 0.5))) return;
      p.possessed = true; info.fx.push('possessed'); for (const x of r.rules || []) RULES[x.k]?.onBattleStart?.(g, me, x, info); },
    onTurnStart(g, me, r, info) { if (g.players[me].possessed) for (const x of r.rules || []) RULES[x.k]?.onTurnStart?.(g, me, x, info); },
    onCardPlayed(g, me, r, info) { if (g.players[me].possessed) for (const x of r.rules || []) RULES[x.k]?.onCardPlayed?.(g, me, x, info); },
    onKingAct(g, me, r, info) { if (g.players[me].possessed) for (const x of r.rules || []) RULES[x.k]?.onKingAct?.(g, me, x, info); } },
  // Daño directo a tu castillo cada N turnos suyos (bombas, rayos del demonio)
  dmgEvery: { text: (r) => `Cada ${r.every} turno${r.every > 1 ? 's' : ''} te pega ${r.amount} directo al castillo`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.dmg = (p.rs.dmg || 0) + 1; if (p.rs.dmg % r.every) return; hit(g.players[1 - me], 0, r.amount); info.fx.push('rule:dmgEvery'); } },
  // Grieta: ayudas de los reyes liberados
  freeStrike: { text: (r) => `Una vez por pelea, en tu primer turno: daño ${r.dmg}`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; if (p.rs.strike) return; p.rs.strike = true; hit(g.players[1 - me], r.dmg, 0); info.fx.push('rule:freeStrike'); } },
  handPlus: { text: (r) => `Mano +${r.amount}`, onBattleStart(g, me, r) { const p = g.players[me]; p.handSize = (p.handSize || 0) + r.amount; for (let i = 0; i < r.amount && p.deck.length; i++) p.hand.push(p.deck.pop()); } },
  startWork: { text: (r) => `Empezás con ${NAMES[r.id][0]} construida`, onBattleStart(g, me, r) { const p = g.players[me]; if (p.works) p.works.push({ id: r.id, age: 0 }); } },
  enemyDrain: { text: (r) => `El rival empieza con −${r.amount} de cada recurso`, onBattleStart(g, me, r) { const o = g.players[1 - me]; for (const k of ['brick', 'weapon', 'crystal']) o[k] = Math.max(0, o[k] - r.amount); } },
};
// daño de regla (sin carta): primero al muro, lo que sobra al castillo; `direct` va derecho al castillo
function hit(q, dmg, direct) { q.wall -= dmg; if (q.wall < 0) { q.castle += q.wall; q.wall = 0; } q.castle = Math.max(0, q.castle - direct); }
// Regla demoníaca de cada rey (fase poseída, Juan 27/10): lo que hace desde que el demonio lo posee
export const DEMON_RULES = {
  humano: [{ k: 'curseEvery', every: 3, id: 192 }],                 // Aldric poseído: cada 3 turnos te mete Miedo en la mano (tus ataques −1). Medido: cada turno el jugador ganaba 12 %; así, 28 %
  enano: [{ k: 'regenWall', amount: 6 }],                            // Thorgrim: su muro se regenera +6 por turno
  orco: [{ k: 'lowCastleBonus', below: 999, amount: 4 }],           // Gorrak: todos sus ataques +4
  elfo: [{ k: 'costUp', res: 5, amount: 3 }],                        // Aelwyn: tus cartas de cristales cuestan 3 más
  gnomo: [{ k: 'dmgEvery', every: 2, amount: 5 }],                   // Fizzwick: cada 2 turnos una bomba, 5 directo al castillo
  drow: [{ k: 'curseEvery', every: 1, id: 194 }],                    // Vaelith: cada turno te mete Pánico (tus cartas cuestan 1 más)
};
export const possessRule = (race, at = 0.5) => ({ k: 'possess', at, rules: DEMON_RULES[race] || [] });
// Grieta: lo que da cada rey liberado en la pelea final (Juan 27/10; números a medir) y las míticas de los otros reyes
export const GRIETA_ALLIES = {
  humano: { k: 'startRes', amount: 6 },             // Aldric: +6 de cada recurso al arrancar
  enano: { k: 'startStat', stat: 'wall', amount: 15 }, // Thorgrim: muro +15 al arrancar
  orco: { k: 'freeStrike', dmg: 15 },              // Gorrak: un golpe de 15 gratis en tu primer turno
  elfo: { k: 'handPlus', amount: 1 },              // Aelwyn: mano +1
  gnomo: { k: 'startWork', id: 250 },              // Fizzwick: empezás con una Torreta de vapor (Obra)
  drow: { k: 'enemyDrain', amount: 8 },            // Vaelith: el rival empieza con −8 de cada recurso
};
export const MYTHIC_OF = { humano: 180, enano: 181, elfo: 182, drow: 183, gnomo: 184, orco: 185 };
// grietaSetup(tuRaza, razasLiberadas) → { rules: ayudas (sumalas a player.rules), mythics: ids de "Ataque del rey" de los OTROS reyes liberados
// (sumalas al mazo; al jugarlas entra el rey invitado: fx 'guestKing:<raza>', y tu rey no se desmaya) }
export function grietaSetup(race, freed = []) {
  return { rules: freed.map((r) => GRIETA_ALLIES[r]).filter(Boolean), mythics: freed.filter((r) => r !== race).map((r) => MYTHIC_OF[r]).filter(Boolean) };
}
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
      deck: deckOf({ 8: 2, 37: 1, 50: 1, 60: 1, 6: 2, 2: 2, 62: 1, 63: 1, 66: 1, 36: 1, 11: 1, 68: 1, 69: 1 }), rules: [{ k: 'startRes', amount: 2 }, possessRule('humano', 0.5)] }, // con la fase poseída arranca con +2 (antes +8)
  },
};
export const BOSS_LOOT = { humano: [200, 201] };
// Variedad (Juan 27/10): 2-3 enemigos por tier y reino para el mapa procedural. ENEMIES[reino][tier] sigue siendo el primero (compatibilidad);
// enemyFor(reino, tier, rnd) elige uno del pozo. kind: 'campamento' | 'bestia' (sin muro) | 'castillo' | 'constructo' (para el arte, S04/S10).
export const ENEMY_POOL = {
  humano: {
    t1: [ { ...ENEMIES.humano.t1, kind: 'campamento' },
      { name: 'Jauría de lobos', tier: 1, kind: 'bestia', race: null, king: false, ai: 'facil', hand: 3, plays: 1, capWall: 0, res: U(1, 3, 1, 2, 6, 2, 0, 32),
        deck: deckOf({ 196: 4, 1: 4, 2: 4, 6: 1 }), rules: [] },
      { name: 'Bandidos del camino', tier: 1, kind: 'campamento', race: null, king: false, ai: 'facil', hand: 3, plays: 1, res: U(1, 2, 1, 4, 6, 4, 8, 32),
        deck: deckOf({ 196: 3, 2: 3, 25: 2, 26: 1, 27: 1, 34: 1, 6: 1 }), rules: [] } ],
    t2: [ { ...ENEMIES.humano.t2, kind: 'castillo' },
      { name: 'Torre de arqueros', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 1, 6, 10, 4, 30, 38),
        deck: deckOf({ 197: 4, 2: 4, 6: 3, 8: 2, 36: 1 }), rules: [] },
      { name: 'Constructo de piedra', tier: 2, kind: 'constructo', race: null, king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(2, 2, 1, 8, 6, 2, 20, 45),
        deck: deckOf({ 37: 3, 38: 3, 3: 1, 36: 2, 11: 2, 197: 2 }), rules: [{ k: 'regenWall', amount: 3 }] } ],
    t3: [ { ...ENEMIES.humano.t3, kind: 'castillo' },
      { name: 'Gólem de asedio', tier: 3, kind: 'constructo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, capWall: 0, res: U(2, 2, 1, 10, 8, 4, 0, 75),
        deck: deckOf({ 37: 3, 3: 2, 38: 3, 198: 2, 48: 1, 30: 1 }), rules: [{ k: 'bigHit', every: 2 }] },
      { name: 'Capitán mercenario', tier: 3, kind: 'campamento', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 1, 6, 10, 4, 25, 60),
        deck: deckOf({ 198: 3, 8: 3, 37: 1, 6: 3, 9: 2, 36: 1, 34: 1 }), rules: [{ k: 'startRes', amount: 6 }] } ],
    lor: [ENEMIES.humano.lor],
    rey: [ENEMIES.humano.rey],
  },
};
export function enemyFor(reino, tier, rnd = Math.random) { const l = ENEMY_POOL[reino]?.[tier] || (ENEMIES[reino]?.[tier] ? [ENEMIES[reino][tier]] : null); return l ? l[Math.floor(rnd() * l.length)] : null; }

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
      { deck: enemy.deck, hand: enemy.hand, res: enemy.res, race: enemy.race, king: !!enemy.king, hooks: ruleHooks(er), rules: er, plays: enemy.plays || 1, discardHand: !!enemy.discardHand, ...(enemy.capWall != null ? { capWall: enemy.capWall } : {}) },
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
