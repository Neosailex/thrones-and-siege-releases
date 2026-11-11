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
  // (S03 08/11) enano: 10 básicas + las ★ de runas (Grabar piedra x2, Chispa rúnica x2, Martillazo)
  enano: deckOf({ 2: 3, 6: 1, 36: 2, 34: 1, 37: 1, 30: 1, 54: 1, 400: 2, 401: 2, 402: 1 }),
  // orco: 10 básicas + las ★ de Furia (Tajo sangriento x2, Rugido, Embestida x2)
  orco: deckOf({ 2: 3, 6: 1, 36: 2, 34: 1, 37: 1, 30: 1, 54: 1, 420: 2, 421: 1, 422: 2 }),
  // elfo: 10 básicas + las ★ de Flechas (Arco corto x2, Ojo de águila, Puntería x2)
  elfo: deckOf({ 2: 3, 6: 1, 36: 2, 34: 1, 37: 1, 30: 1, 54: 1, 441: 2, 442: 1, 443: 2 }),
  // gnomo: 10 básicas + las ★ de Caldera (Válvula x2, Prototipo x2, Remiendo)
  gnomo: deckOf({ 2: 3, 6: 1, 36: 2, 34: 1, 37: 1, 30: 1, 54: 1, 460: 2, 461: 2, 462: 1 }),
  // drow: 10 básicas + las ★ de Veneno (Daga envenenada x2, Pacto oscuro x2, Niebla)
  drow: deckOf({ 2: 3, 6: 1, 36: 2, 34: 1, 37: 1, 30: 1, 54: 1, 480: 2, 481: 2, 482: 1 }),
};
// Mazo de referencia a mitad de run (solo para medir el balance de Lor/Rey: el inicial + 5 recompensas típicas)
// (25/10) con las cartas nuevas de campaña: el inicial + Arqueros, Catedral, Estandarte del reino, Mercenarios, Veterano, Reconstrucción mayor; ~60 de oro a esta altura
export const MIDRUN_DECKS = { humano: deckOf({ 2: 2, 6: 2, 8: 2, 37: 1, 60: 1, 54: 1, 34: 2, 36: 1, 30: 1, 62: 1, 63: 1, 64: 1, 68: 1, 216: 1, 210: 1, 270: 1, 277: 1 }) };
export const MIDRUN_GOLD = 60;
// Estado base del jugador al empezar la campaña (la aldea lo sube). castle/wall se pisan con lo que arrastra la run.
// (S03 08/11) razas jugables de campaña (docs/campaña/razas.md §1): el humano juega como en el PvP; las demás, con su mecánica propia
// humanPassive: el sostén del humano (recurso más bajo +1, muro +1 con menos de 10) — sin él el orco ganaba 0-2 % de las runs (el humano sin su pasiva, 2 %)
export const CAMP_RACE = { enano: { noPassive: true, humanPassive: true }, orco: { noPassive: true, fury: true, humanPassive: true }, elfo: { noPassive: true, aim: true, humanPassive: true }, gnomo: { noPassive: true, boiler: true, humanPassive: true }, drow: { noPassive: true, pact: true, humanPassive: true } };
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
  enrage: { text: (r) => `Cada ${r.every > 1 ? r.every + ' ataques tuyos le suman' : 'ataque tuyo le suma'} +${r.amount} a su próximo ataque`, onCardPlayed(g, me, r, info) { if (info.seat === me || !info.attack) return; const p = g.players[me]; p.rs.enr = (p.rs.enr || 0) + 1; if (p.rs.enr % (r.every || 1)) return; p.rage = (p.rage || 0) + r.amount; info.fx.push('rule:enrage'); } },
  // Castillo bajo pega más (Gorrak)
  lowCastleBonus: { text: (r) => `Con castillo por debajo de ${r.below}, sus ataques hacen +${r.amount}`, onBattleStart(g, me, r) { g.players[me].lowCastleBonus = { below: r.below, amount: r.amount }; } },
  // Te mete una maldición/estado cada N turnos (Lor drow, cultistas)
  // (S03 04/11) `ids` mete varias juntas (Coleccionista: Miedo, Pánico y Brecha)
  curseEvery: { text: (r) => `${r.every > 1 ? `Cada ${r.every} turnos` : 'Cada turno'} te mete ${(r.ids || [r.id]).map((i) => NAMES[i][0]).join(', ').replace(/, ([^,]*)$/, ' y $1')}`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.curse = (p.rs.curse || 0) + 1; if (p.rs.curse % r.every) return; for (const id of r.ids || [r.id]) { E.giveCard(g, g.players[1 - me], id); info.fx.push('curse:' + id); } } },
  // Encarece las cartas del rival de un recurso (Lor elfo: cristales +2). res: 1 ladrillos, 3 armas, 5 cristales
  costUp: { text: (r) => `Tus cartas de ${{ 1: 'ladrillos', 3: 'armas', 5: 'cristales' }[r.res]} cuestan ${r.amount} más`, onBattleStart(g, me, r) { const o = g.players[1 - me]; o.costMod = o.costMod || [0, 0, 0, 0, 0, 0, 0, 0]; o.costMod[r.res] += r.amount; } },
  // Empieza con una trampa armada (Lor gnomo)
  startTrap: { text: (r) => 'Empieza con una trampa armada', onBattleStart(g, me, r) { g.players[me].trap = r.trap; } },
  // Su rey actúa más seguido (Thorgrim cada 3): se pasa por kingPeriod en el asiento, acá solo texto
  kingPeriod: { text: (r) => `Su rey actúa cada ${r.period} turnos`, onBattleStart(g, me, r) { g.players[me].kingPeriod = r.period; } },
  // Equipo del jugador: +N de una unidad / muro / castillo al empezar cada pelea (Yelmo del constructor, cabra enana…)
  // (S03 08/11) también negativo (contras de artefactos): no baja de 0 (unidades: de 1)
  startStat: { text: (r) => `Al empezar cada pelea: ${r.stat} ${r.amount < 0 ? '' : '+'}${r.amount}`, onBattleStart(g, me, r) { const p = g.players[me], min = ['builder', 'recruit', 'mage'].includes(r.stat) ? 1 : 0; p[r.stat] = Math.max(Math.min(min, p[r.stat] || 0), (p[r.stat] || 0) + r.amount); } },
  /* ---- contras de los artefactos (S03 08/11, docs/campaña/razas.md §3a; el cliente las pasa en contraRules) ---- */
  // Espada de Aldric: la primera vez que tenés favor en la pelea, perdés 1
  favorTax: { text: (r) => `−${r.amount || 1} de favor por pelea`, onTurnStart(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.favTax || !(p.favor > 0)) return; p.rs.favTax = true; p.favor = Math.max(0, p.favor - (r.amount || 1)); return true; } },
  // Martillo de Thorgrim: tus ataques −1 en tu primer turno
  weakStart: { text: (r) => `Tus ataques −${r.amount || 1} el primer turno`, onBattleStart(g, me, r) { const p = g.players[me]; p.atkPlus = (p.atkPlus || 0) - (r.amount || 1); p.rs.wsT = g.turn === me ? 1 : 2; p.rs.wsN = 0; },
    onTurnStart(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || !p.rs.wsT) return; if (++p.rs.wsN < p.rs.wsT) return; p.atkPlus = (p.atkPlus || 0) + (r.amount || 1); p.rs.wsT = 0; } },
  // Cabra enana: come 1 ladrillo por turno
  eatRes: { text: (r) => `Cada ${r.every > 1 ? r.every + ' turnos' : 'turno'} se come ${r.amount} de ${{ brick: 'ladrillos', weapon: 'armas', crystal: 'cristales' }[r.res]}`, onTurnStart(g, me, r, info) { const p = g.players[me]; if (info.seat !== me) return; p.rs['eat' + r.res] = (p.rs['eat' + r.res] || 0) + 1; if (p.rs['eat' + r.res] % (r.every || 1)) return; p[r.res] = Math.max(0, p[r.res] - r.amount); return true; } },
  // Cuervo mensajero: mano −1 el primer turno (la carta vuelve al mazo)
  handMinusFirst: { text: () => 'Mano −1 el primer turno', onBattleStart(g, me) { const p = g.players[me]; if (p.hand.length > 1) p.deck.splice(Math.floor(g._rnd() * (p.deck.length + 1)), 0, p.hand.pop()); } },
  // Anillo de carga: cuando tu rey actúa, su efecto es 1 menor
  kingWeak: { text: (r) => `Cuando tu rey actúa, su efecto es ${r.amount || 1} menor`, onBattleStart(g, me, r) { g.players[me].kingWeak = r.amount || 1; } },
  // Corona rota: cuando tu rey actúa, perdés 3 de vida
  kingPain: { text: (r) => `Cuando tu rey actúa, perdés ${r.amount} de vida`, onKingAct(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.castle = Math.max(0, p.castle - r.amount); if (p.castle <= 0 && g.winner == null) g.winner = 1 - me; return true; } },
  // Engranaje eterno: cada Obra cuesta +1 · Cuerno de batalla: la primera carta del rival también es gratis · Talismán: tus Rápidas no roban · Frasco: los estados del rival a vos también duran más
  workTax: { text: (r) => `Cada Obra cuesta +${r.amount || 1}`, onBattleStart(g, me, r) { g.players[me].workTax = r.amount || 1; } },
  foeFirstFree: { text: () => 'La primera carta del rival también es gratis', onBattleStart(g, me) { g.players[1 - me].firstFree = true; } },
  rapidNoDraw: { text: () => 'Tus Rápidas no roban carta', onBattleStart(g, me) { g.players[me].rapidNoDraw = true; } },
  statesBack: { text: () => 'Los estados del rival a vos también duran un turno más', onBattleStart(g, me) { g.players[me].poisonVial = true; } },
  /* ---- Veneno del drow (S03 08/11) ---- */
  venomStartFoe: { text: (r) => `El rival arranca con ${r.n} de veneno`, onBattleStart(g, me, r) { const o = g.players[1 - me]; o.venom = (o.venom || 0) + r.n; } },
  firstPactX2: { text: () => 'Tu primer pacto de cada pelea vale doble', onBattleStart(g, me) { g.players[me].firstPactX2 = true; } },
  colmilloArana: { name: 'Colmillo de araña', rar: 'comun', race: 'drow', quita: 'Tus ataques −1', text: () => 'Cada ataque tuyo le pone 1 de veneno al rival', onBattleStart(g, me) { const p = g.players[me]; p.atkVenom = 1; p.atkPlus = (p.atkPlus || 0) - 1; } },
  veloSombra: { name: 'Velo de sombra', rar: 'comun', race: 'drow', quita: 'Cada pelea te mete un Miedo en el mazo', text: () => 'Tu primer pacto de cada pelea no gasta jugada', onBattleStart(g, me) { const p = g.players[me]; p.freePact = true; p.deck.splice(Math.floor(g._rnd() * (p.deck.length + 1)), 0, 192); } },
  telarana: { name: 'Telaraña', rar: 'raro', race: 'drow', quita: 'Tu veneno baja 2 por turno', text: () => 'El rival envenenado no se cura', onBattleStart(g, me) { const p = g.players[me]; p.webNoHeal = true; p.venomDecay = 2; } },
  frascoSombra: { name: 'Frasco de sombra', rar: 'raro', race: 'drow', quita: 'Vida máxima −5', contra: [{ k: 'hpMax', v: -5 }], text: () => 'Tu veneno no baja la primera vez', onBattleStart(g, me) { g.players[me].venomHold = true; } },
  pactoEterno: { name: 'Pacto eterno', rar: 'jefe', race: 'drow', quita: 'Cada pelea arrancás con 2 Miedos en el mazo', text: () => 'Cada pacto vale doble', onBattleStart(g, me) { const p = g.players[me]; p.pactMul = 2; for (let i = 0; i < 2; i++) p.deck.splice(Math.floor(g._rnd() * (p.deck.length + 1)), 0, 192); } },
  /* ---- Caldera del gnomo (S03 08/11) ---- */
  inventStart: { text: (r) => `Tus Inventos arrancan +${r.n}`, onBattleStart(g, me, r) { const p = g.players[me]; p.invBonus = (p.invBonus || 0) + r.n; } },
  freeValve: { text: () => 'La primera vez que la caldera explota no te hace daño', onBattleStart(g, me) { g.players[me].safeValve = true; } },
  valvulaSeguridad: { name: 'Válvula de seguridad', rar: 'comun', race: 'gnomo', quita: 'La caldera aguanta 2 menos', text: () => 'La primera vez que la caldera explota no te hace daño', onBattleStart(g, me) { const p = g.players[me]; p.safeValve = true; p.boilerMaxMod = (p.boilerMaxMod || 0) - 2; } },
  engrasador: { name: 'Engrasador', rar: 'comun', race: 'gnomo', quita: 'Tus cartas de muro suman 1 de presión más', text: () => 'Tus Inventos arrancan +1', onBattleStart(g, me) { const p = g.players[me]; p.invBonus = (p.invBonus || 0) + 1; p.wallPress = 1; } },
  engranajeMaestro: { name: 'Engranaje maestro', rar: 'raro', race: 'gnomo', quita: '−2 ladrillos por turno', text: () => 'Tus Inventos mejoran el doble', onBattleStart(g, me) { g.players[me].invDouble = true; }, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.brick = Math.max(0, p.brick - 2); return true; } },
  manometroLaton: { name: 'Manómetro de latón', rar: 'raro', race: 'gnomo', quita: 'La caldera explota en 9', text: () => 'Liberar la caldera da 25 % más', onBattleStart(g, me) { const p = g.players[me]; p.releaseMul = 1.25; p.boilerMaxMod = (p.boilerMaxMod || 0) - 2; } },
  calderaInestable: { name: 'Caldera inestable', rar: 'jefe', race: 'gnomo', quita: 'La explosión te hace 20', text: () => 'La caldera aguanta 4 más y liberarla da 50 % más', onBattleStart(g, me) { const p = g.players[me]; p.boilerMaxMod = (p.boilerMaxMod || 0) + 4; p.releaseMul = 1.5; p.boomDmg = 20; } },
  /* ---- Flechas del elfo (S03 08/11) ---- */
  aimStart: { text: (r) => `Arrancás con Puntería +${r.n}`, onBattleStart(g, me, r) { const p = g.players[me]; p.aim = (p.aim || 0) + r.n; } },
  arrowEachTurn: { text: (r) => `Te da ${r.n} Flecha al empezar cada turno tuyo`, onBattleStart(g, me, r) { const p = g.players[me]; p.arrowTurn = (p.arrowTurn || 0) + r.n; } },
  carcaj: { name: 'Carcaj', rar: 'comun', race: 'elfo', quita: 'El Ojo de águila ve 1 carta menos', text: () => 'Puntería +1 al empezar cada pelea', onBattleStart(g, me) { const p = g.players[me]; p.aim = (p.aim || 0) + 1; p.eyeMod = (p.eyeMod || 0) - 1; } },
  plumaAguila: { name: 'Pluma de águila', rar: 'comun', race: 'elfo', quita: '−1 cristal por turno', text: () => 'El Ojo de águila ve 1 carta más', onBattleStart(g, me) { g.players[me].eyeMod = (g.players[me].eyeMod || 0) + 1; }, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.crystal = Math.max(0, p.crystal - 1); return true; } },
  arcoLuna: { name: 'Arco de la luna', rar: 'raro', race: 'elfo', quita: 'Tus cartas de muro dan 2 menos', text: () => 'Te da 1 Flecha al empezar cada turno tuyo', onBattleStart(g, me) { const p = g.players[me]; p.arrowTurn = (p.arrowTurn || 0) + 1; p.wallMinus = (p.wallMinus || 0) + 2; } },
  cuerdaElfica: { name: 'Cuerda élfica', rar: 'raro', race: 'elfo', hand: -1, quita: 'Tu mano es 1 menos', text: () => 'Tus Flechas hacen +2', onBattleStart(g, me) { g.players[me].arrowPlus = (g.players[me].arrowPlus || 0) + 2; } },
  cuerdaPlata: { name: 'Cuerda de plata', rar: 'jefe', race: 'elfo', quita: 'Máximo 4 Flechas por turno', text: () => 'Tus Flechas hacen el doble', onBattleStart(g, me) { const p = g.players[me]; p.arrowMul = 2; p.arrowCap = 4; } },
  /* ---- Furia del orco (S03 08/11) ---- */
  furyStart: { text: (r) => `Arrancás con ${r.n} de Furia`, onBattleStart(g, me, r, info) { const p = g.players[me]; p.fury = Math.min(10, (p.fury || 0) + r.n); info.fx?.push('fury:' + p.fury); } },
  frenzyPlus: { text: (r) => `El Frenesí dura ${r.n} turno${r.n > 1 ? 's' : ''} más`, onBattleStart(g, me, r) { const p = g.players[me]; p.frenzyBonus = (p.frenzyBonus || 0) + r.n; } },
  collarColmillos: { name: 'Collar de colmillos', rar: 'comun', race: 'orco', quita: 'El Frenesí dura 1 turno', text: () => '+1 de Furia extra cada vez que te pegan', onBattleStart(g, me) { const p = g.players[me]; p.furyRecv = 1; p.frenzyTurns = 1; } },
  pinturaGuerra: { name: 'Pintura de guerra', rar: 'comun', race: 'orco', quita: 'Muro −4 al empezar cada pelea', text: () => 'Arrancás cada pelea con 3 de Furia', onBattleStart(g, me, r, info) { RULES.furyStart.onBattleStart(g, me, { n: 3 }, info); const p = g.players[me]; p.wall = Math.max(0, p.wall - 4); } },
  tamborSangre: { name: 'Tambor de sangre', rar: 'raro', race: 'orco', quita: 'Vida máxima −5', contra: [{ k: 'hpMax', v: -5 }], text: () => 'Tus cartas de sangre cuestan 1 de vida menos', onBattleStart(g, me) { g.players[me].bloodLess = 1; } },
  trofeoCampeon: { name: 'Trofeo del campeón', rar: 'raro', race: 'orco', quita: 'Si en tu turno no pegás, la Furia baja 2', text: () => 'Al entrar en Frenesí curás 5', onBattleStart(g, me) { const p = g.players[me]; p.frenzyHeal = 5; p.furyDecay = 2; } },
  ojosRojos: { name: 'Ojos rojos', rar: 'jefe', race: 'orco', quita: 'No te podés curar', text: () => 'El Frenesí no termina', onBattleStart(g, me) { const p = g.players[me]; p.frenzyForever = true; p.noHeal = true; } },
  /* ---- runas del enano (S03 08/11) ---- */
  runeStart: { text: (r) => `Arrancás con ${r.n || 1} runa de ${r.t} grabada`, onBattleStart(g, me, r, info) { const p = g.players[me]; p.runes ||= []; for (let i = 0; i < (r.n || 1); i++) if (p.runes.length < E.runeSlots(p)) { p.runes.push(r.t); info.fx?.push('rune:grabar:' + r.t); } } },
  runeSlot: { text: (r) => `+${r.amount || 1} ranura de runa`, onBattleStart(g, me, r) { const p = g.players[me]; p.runeSlots = E.runeSlots(p) + (r.amount || 1); } },
  // equipo de raza del enano (§3c)
  piedraAfilar: { name: 'Piedra de afilar', rar: 'comun', race: 'enano', quita: 'Tus runas de Piedra dan 1 menos', text: () => 'Tus runas de Fuego hacen +1', onBattleStart(g, me) { g.players[me].runeMod = { ...(g.players[me].runeMod || {}), fuego: 1, piedra: -1 }; } },
  cuencoRunas: { name: 'Cuenco de runas', rar: 'comun', race: 'enano', quita: 'Ladrillos −2 al empezar cada pelea', text: () => 'Arrancás cada pelea con una runa de Piedra grabada', onBattleStart(g, me, r, info) { RULES.runeStart.onBattleStart(g, me, { t: 'piedra' }, info); const p = g.players[me]; p.brick = Math.max(0, p.brick - 2); } },
  cincelRunico: { name: 'Cincel rúnico', rar: 'raro', race: 'enano', quita: 'Romper una runa da x2 en vez de x3', text: () => 'Tenés una 4.ª ranura de runa', onBattleStart(g, me) { const p = g.players[me]; p.runeSlots = E.runeSlots(p) + 1; p.breakMul = 2; } },
  yunqueEcos: { name: 'Yunque de ecos', rar: 'raro', race: 'enano', quita: 'Muro −5 al empezar cada pelea', text: () => 'La primera runa que rompés en cada pelea se vuelve a grabar', onBattleStart(g, me) { const p = g.players[me]; p.echoBreak = true; p.wall = Math.max(0, p.wall - 5); } },
  coronaBasalto: { name: 'Corona de basalto', rar: 'jefe', race: 'enano', quita: 'No podés romper runas', text: () => 'Tus runas actúan dos veces', onBattleStart(g, me) { const p = g.players[me]; p.runeTimes = 2; p.noBreak = true; } },
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
  cartographer: { name: 'Mapa del cartógrafo', rar: 'jefe', seeMap: true, text: () => 'Ves todo el mapa y los enemigos de cada nodo; las fogatas curan la mitad' },
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
  /* ---- enemigos del reino humano (S03 01/11, docs/campaña/enemigos.md) ---- */
  // Robo: cada golpe que llega a tu castillo te saca `amount` del recurso que más tenés (se lo queda)
  steal: { text: (r) => `Cada golpe que llega a tu castillo te roba ${r.amount} ${r.res ? { brick: 'ladrillos', weapon: 'armas', crystal: 'cristales', favor: 'de favor' }[r.res] : 'del recurso que más tenés'}`, onDamage(g, me, r, info) { if (info.seat === me || !(info.castle > 0)) return; const v = g.players[info.seat], p = g.players[me]; const k = r.res || ['brick', 'weapon', 'crystal'].sort((a, b) => v[b] - v[a])[0], n = Math.min(r.amount, v[k]); if (n <= 0) return; v[k] -= n; p[k] += n; p.rs.stolen = (p.rs.stolen || 0) + n; info.fx.push('rule:steal'); } },
  // Huida: al empezar su turno N se escapa → ganás la pelea, pero sin oro (battleResult.fled)
  flee: { text: (r) => `Al empezar su turno ${r.turn} se escapa con lo robado: ganás, pero sin oro`, onTurnStart(g, me, r, info) { if (info.seat !== me || g.winner != null) return; const p = g.players[me]; p.rs.ft = (p.rs.ft || 0) + 1; if (p.rs.ft < r.turn) return; g.winner = 1 - me; g.fled = true; info.fx.push('rule:flee'); } },
  // Ritual: desde su segundo turno, sus ataques pegan +amount acumulativo por turno
  ritual: { text: (r) => `Desde su segundo turno, sus ataques pegan +${r.amount} más cada turno (acumulativo)`, onBattleStart(g, me) { if (g.turn === me) g.players[me].rs.rt = 1; }, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.rt = (p.rs.rt || 0) + 1; if (p.rs.rt < 2) return; p.atkPlus = (p.atkPlus || 0) + r.amount; info.fx.push('rule:ritual'); } },
  // Enjambre: cada N turnos llega otro: sus ataques +amount (acumulativo)
  swarm: { text: (r) => `Cada ${r.every} turnos llega otro: sus ataques +${r.amount} (acumulativo)`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.sw = (p.rs.sw || 0) + 1; if (p.rs.sw % r.every) return; p.atkPlus = (p.atkPlus || 0) + r.amount; info.fx.push('rule:swarm'); } },
  // Escurridizo: la primera vez que recibe daño, ignora `amount`
  curlOnce: { text: (r) => `La primera vez que recibe daño, ignora ${r.amount}`, onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.curled || !((info.wall || 0) + (info.castle || 0) > 0)) return; p.rs.curled = true; const c = Math.min(r.amount, info.castle || 0); p.castle += c; p.wall += Math.min(r.amount - c, info.wall || 0); info.fx.push('rule:curlOnce'); } },
  // Gusano: cava (su próximo golpe saltea tu muro) y se entierra (muro de bicho hasta su turno): lo hacen sus acciones (310-312)
  burrow: { text: () => 'Cava: su próximo golpe va directo a tu castillo; se entierra: muro +8 hasta su próximo turno' },
  // Secuaz (minion en el enemigo): segundo muro con vida propia; mientras vive le cura `heal` por turno al castillo y sus ataques +atk; al caer, +rage
  minion: { text: (r) => `Tiene un secuaz (${r.name || 'torre'}, vida ${r.hp}): tus ataques le pegan primero` + (r.heal || r.atk ? `; mientras vive${r.heal ? ` le cura ${r.heal} por turno` : ''}${r.heal && r.atk ? ' y' : ''}${r.atk ? ` sus ataques +${r.atk}` : ''}` : '') + (r.rage ? `; cuando cae, sus ataques +${r.rage}` : ''),
    onBattleStart(g, me) { const p = g.players[me]; p.rs.c0 = p.castle; },
    onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; if (!(p.minionHp > 0) || !p.minionHeal) return; p.castle = Math.min(Math.max(p.rs.c0 || p.castle, p.castle), p.castle + p.minionHeal); info.fx.push('rule:minion'); } },
  // Furia del ogro: cada carta tuya que te sube muro o castillo le suma +amount a sus ataques (toda la pelea)
  buildRage: { text: (r) => `Cada carta tuya que te sube muro o castillo: sus ataques +${r.amount} (toda la pelea)`, onCardPlayed(g, me, r, info) { if (info.seat === me) return; const s = CARDS[info.id]?.[1]; if (!s || !(s[6] > 0 || s[7] > 0)) return; const p = g.players[me]; p.atkPlus = (p.atkPlus || 0) + r.amount; info.fx.push('rule:buildRage'); } },
  // Páginas: cada turno pega una vez más que el anterior (lo usa la acción Página, 316)
  pages: { text: () => 'Cada turno pega una vez más que el anterior (1, 2, 3… golpes)', onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.pageHits = (p.pageHits || 0) + 1; info.fx.push('rule:pages'); } },
  // Heridas: cada golpe suyo que llega a tu castillo te mete una Herida (203, basura hasta fin de pelea)
  woundOnHit: { text: () => 'Cada golpe que llega a tu castillo te mete una Herida', onDamage(g, me, r, info) { if (info.seat === me || info.from !== me || !(info.castle > 0)) return; E.giveCard(g, g.players[info.seat], r.id || 203); info.fx.push('curse:' + (r.id || 203)); } },
  /* ---- reino enano (S03 04/11) ---- */
  // Duerme N turnos (Oso): juega su acción de dormir (armadura); si le pegás, se despierta. Despierto, su patrón normal.
  sleep: { text: (r) => `Duerme ${r.turns} turnos (gana muro); si le pegás, se despierta`,
    onBattleStart(g, me, r) { const p = g.players[me]; p.rs.asleep = r.turns; p.rs.next = r.id; },
    onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; if (p.rs.asleep > 0) { p.rs.asleep--; p.rs.next = r.id; if (!p.rs.asleep) { p.rs.next = null; info.fx.push('rule:wake'); } } },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || !(p.rs.asleep > 0) || !((info.wall || 0) + (info.castle || 0) > 0)) return; p.rs.asleep = 0; if (p.rs.next === r.id) p.rs.next = null; info.fx.push('rule:wake'); } },
  // Cambio de modo (Guardián de hierro): cuando le sacás `threshold`, pasa a modo muralla (muro +wall, espinas) `turns` turnos
  guardian: { text: (r) => `Cuando le sacás ${r.threshold}, se cierra ${r.turns} turnos: recibe la mitad de daño y tiene espinas ${r.thorns} (tus ataques te lastiman el muro)`,
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.mode === 'muralla') return; p.rs.dmg = (p.rs.dmg || 0) + (info.wall || 0) + (info.castle || 0); if (p.rs.dmg < r.threshold) return;
      p.rs.dmg = 0; p.rs.mode = 'muralla'; p.rs.modeT = r.turns; p.guardHalf = true; p.thorns = r.thorns; p.rs.next = r.id; info.fx.push('rule:mode'); },
    onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; if (p.rs.mode !== 'muralla') return; if (--p.rs.modeT > 0) { p.rs.next = r.id; return; } p.rs.mode = null; p.thorns = 0; p.guardHalf = false; p.rs.next = null; info.fx.push('rule:modeEnd'); } },
  /* ---- reino orco (S03 04/11) ---- */
  // Sacrificio (Chamán): cada turno pierde `hp` de vida y sus ataques +atk (acumulativo)
  sacrifice: { text: (r) => `Cada turno pierde ${r.hp} de vida y sus ataques pegan +${r.atk} (acumulativo)`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.castle = Math.max(0, p.castle - r.hp); p.atkPlus = (p.atkPlus || 0) + r.atk; if (p.castle <= 0 && g.winner == null) g.winner = 1 - me; info.fx.push('rule:sacrifice'); } },
  // Fases (Campeón): a media vida, una vez: se limpia, rompe su muro y pega doble
  execute: { text: () => 'A media vida se limpia, rompe su muro y pega el doble', onBattleStart(g, me) { g.players[me].rs.c0 = g.players[me].castle; },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.exec || p.castle <= 0 || p.castle > (p.rs.c0 || p.castle) / 2) return; p.rs.exec = true; p.effects = (p.effects || []).filter((e) => e.from == null || g.players[e.from] === p); p.statsType = 0; p.wall = 0; p.atkMul = 2; info.fx.push('rule:execute'); } },
  /* ---- reino elfo (S03 04/11) ---- */
  // Esporas (Hongo): si lo matás, empezás la próxima pelea con Vulnerable (battleResult.carry)
  spores: { text: () => 'Al morir larga esporas: empezás la próxima pelea con Vulnerable' },
  // Maleable (Planta): cada golpe que recibe le da más muro que el anterior (start, start+1, …)
  malleable: { text: (r) => `Cada golpe que recibe le da muro: ${r.start}, después ${r.start + 1}, ${r.start + 2}…`, onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || !((info.wall || 0) + (info.castle || 0) > 0)) return; p.rs.mal = (p.rs.mal ?? r.start); p.wall += p.rs.mal; if (p.capWall != null) p.wall = Math.min(p.wall, p.capWall); p.rs.mal = Math.min(r.max || 99, p.rs.mal + 1); info.fx.push('rule:malleable'); } },
  // Cura de castillo por turno (Ent)
  regenCastle: { text: (r) => `Se cura ${r.amount} por turno`, onBattleStart(g, me) { g.players[me].rs.c0 = g.players[me].castle; }, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.castle = Math.min(p.rs.c0 || p.castle, p.castle + r.amount); info.fx.push('rule:regenCastle'); } },
  // Intangible un turno sí y uno no (Serpiente): el turno que juega "Se sumerge", hasta su próximo turno, cada golpe le hace 1
  intangibleEvery: { text: () => 'Un turno sí y uno no se vuelve intangible: cada golpe le hace 1', onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.intangible = false; }, onCardPlayed(g, me, r, info) { if (info.seat === me && info.id === r.id) g.players[me].intangible = true; } },
  /* ---- reino gnomo (S03 04/11) ---- */
  // Placas (Tortuga): cada turno vuelve a tener `n` de muro; cada golpe que le llega a la vida le baja 1 placa
  plates: { text: (r) => `Placas: cada turno vuelve a tener ${r.n} de muro; cada golpe a su vida le saca una placa`, onBattleStart(g, me, r) { g.players[me].rs.plates = r.n; }, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.wall = Math.max(p.wall, p.rs.plates || 0); }, onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat === me && info.castle > 0 && p.rs.plates > 0) { p.rs.plates--; info.fx.push('rule:plates'); } } },
  // Estasis (Autómata): mientras sus orbes (secuaz) vivan, al empezar su turno te saca una carta de la mano
  stasis: { text: () => 'Mientras sus orbes vivan, cada turno te saca una carta de la mano', onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me], o = g.players[1 - me]; if (!(p.minionHp > 0) || !o.hand.length) return; const i = Math.floor(g._rnd() * o.hand.length); o.used.push(o.hand[i]); o.hand.splice(i, 1); info.fx.push('rule:stasis'); } },
  // Devorador del tiempo: cada N cartas que jugás te corta el turno y gana +atk
  timeEater: { text: (r) => `Cada ${r.every} cartas que jugás te corta el turno y sus ataques +${r.atk}`, onCardPlayed(g, me, r, info) { if (info.seat === me) return; const p = g.players[me]; p.rs.te = (p.rs.te || 0) + 1; if (p.rs.te % r.every) return; g.playsLeft = 1; g.rapidPending = false; p.atkPlus = (p.atkPlus || 0) + r.atk; info.fx.push('rule:timeEater'); } },
  // Trampa nueva cada N turnos (Lor Tinkle)
  trapEvery: { text: (r) => `Cada ${r.every} turnos arma una trampa nueva`, onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; p.rs.tr = (p.rs.tr || 0) + 1; if (p.rs.tr % r.every || p.trap) return; p.trap = r.traps[Math.floor(g._rnd() * r.traps.length)]; info.fx.push('rule:trapEvery'); } },
  /* ---- reino drow (S03 04/11) ---- */
  // Reviven (Sombras): si el secuaz cae, vuelve con toda la vida a los `turns` turnos suyos, salvo que lo hayas matado entero en un solo turno
  revive: { text: (r) => `Las sombras reviven a los ${r.turns} turnos, salvo que las mates a todas en un mismo turno`,
    onTurnStart(g, me, r, info) { const p = g.players[me]; if (info.seat !== me) { p.rs.mStart = p.minionHp; return; } if (p.minionHp > 0 || !p.rs.rev) return; if (--p.rs.rev > 0) return; p.minionHp = p.minionMax; info.fx.push('rule:revive'); },
    onCardPlayed(g, me, r, info) { const p = g.players[me]; if (info.seat === me || p.minionHp > 0 || p.rs.rev || p.rs.gone) return; if ((p.rs.mStart ?? p.minionMax) >= p.minionMax) { p.rs.gone = true; p.minionAtk = 0; info.fx.push('rule:reviveNo'); } else { p.rs.rev = r.turns; info.fx.push('rule:reviveSoon'); } } },
  // Maleficio (Elegida): desde que juega la acción `id`, cada carta tuya que no ataca te mete `give` (Humo) en el mazo
  hex: { text: () => 'Maleficio: desde que lo lanza, cada carta tuya que no es ataque te mete un Humo en el mazo',
    onCardPlayed(g, me, r, info) { const p = g.players[me]; if (info.seat === me) { if (info.id === r.id) p.rs.hex = true; return; } if (!p.rs.hex || info.attack) return; const o = g.players[1 - me]; o.deck.splice(Math.floor(g._rnd() * (o.deck.length + 1)), 0, r.give || 195); info.fx.push('rule:hex'); } },
  // Reactiva (Masa de telaraña): cada vez que le pegás cambia su próxima acción (al azar entre sus pesos)
  reactive: { text: () => 'Reactiva: cada vez que le pegás cambia lo que va a hacer',
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || !p.weights || !((info.wall || 0) + (info.castle || 0) > 0)) return; p.rs.next = null; E.bugNext(g, p); info.fx.push('rule:reactive'); } },
  // Maldición de la run: la acción `id` te mete `curse` en la mano y además queda en tu mazo de la run (battleResult.curses)
  runCurse: { text: (r) => `${NAMES[r.id][0]}: te mete una ${NAMES[r.curse][0]} que se queda en tu mazo de la run`,
    onCardPlayed(g, me, r, info) { if (info.seat !== me || info.id !== r.id) return; const p = g.players[me]; E.giveCard(g, g.players[1 - me], r.curse); p.rs.rcs = (p.rs.rcs || '') + ',' + r.curse; info.fx.push('curse:' + r.curse); } },
  // Dagas (Domadora): la acción `id` invoca un secuaz de vida `hp`; si sigue vivo a los `turns` turnos suyos, explota (daño `dmg`)
  daggers: { text: (r) => `Invoca dagas (vida ${r.hp}): si siguen vivas a los ${r.turns} turnos, explotan y te hacen ${r.dmg}`,
    onCardPlayed(g, me, r, info) { if (info.seat !== me || info.id !== r.id) return; const p = g.players[me]; if (p.minionHp > 0) return; p.minionHp = r.hp; p.minionMax = r.hp; p.minionName = 'Dagas'; p.minionAtk = 0; p.rs.dag = r.turns; info.fx.push('rule:daggers'); },
    onTurnStart(g, me, r, info) { if (info.seat !== me) return; const p = g.players[me]; if (!(p.minionHp > 0) || !p.rs.dag) return; if (--p.rs.dag > 0) return; p.minionHp = 0; const o = g.players[1 - me]; hit(o, r.dmg, 0); info.fx.push('rule:daggerBoom'); if (o.castle <= 0 && g.winner == null) g.winner = me; } },
  /* ---- La Grieta (S03 04/11) ---- */
  // Se parte (Lodos): a media vida la mitad de la vida que le queda pasa a otro lodo (secuaz) y sus ataques +atk (no suma vida: si sumara, la IA dejaba de pegarle antes de la mitad)
  split: { text: (r) => `A media vida se parte en dos: la mitad de lo que le queda pasa a otro lodo (secuaz) y sus ataques +${r.atk}`, onBattleStart(g, me) { g.players[me].rs.c0 = g.players[me].castle; },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.split || p.castle <= 0 || p.castle > (p.rs.c0 || p.castle) / 2) return; p.rs.split = true; const hp = Math.floor(p.castle / 2); p.castle -= hp; p.minionHp = hp; p.minionMax = hp; p.minionName = 'Lodo partido'; p.minionAtk = r.atk; info.fx.push('rule:split'); } },
  // Ganás aguantando (Espectro): al empezar su turno `turns`+1 se desvanece y ganás; cada golpe que le das le baja 1 a sus ataques (hasta −max)
  endure: { text: (r) => `No se lo puede matar: ganás si aguantás ${r.turns} turnos suyos. Cada golpe que le das le baja 1 a sus ataques (hasta −${r.max})`,
    onTurnStart(g, me, r, info) { if (info.seat !== me || g.winner != null) return; const p = g.players[me]; p.rs.en = (p.rs.en || 0) + 1; if (p.rs.en <= r.turns) return; g.winner = 1 - me; info.fx.push('rule:endure'); },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || (p.rs.weak || 0) >= r.max || !((info.wall || 0) + (info.castle || 0) > 0)) return; p.rs.weak = (p.rs.weak || 0) + 1; p.atkPlus = (p.atkPlus || 0) - 1; info.fx.push('rule:weaken'); } },
  // Combo (Cabeza de piedra): cada ataque tuyo después de la primera carta del turno le hace `amount` más por carta ya jugada
  comboVuln: { text: (r) => `Cuantas más cartas jugás en el turno, más le duele: cada ataque le hace ${r.amount} más por cada carta que ya jugaste ese turno`,
    onTurnStart(g, me, r, info) { if (info.seat !== me) g.players[me].rs.cp = 0; },
    onCardPlayed(g, me, r, info) { if (info.seat === me) return; const p = g.players[me], n = p.rs.cp || 0; p.rs.cp = n + 1; if (!info.attack || !n) return; p.castle = Math.max(0, p.castle - r.amount * n); info.fx.push('rule:combo'); if (p.castle <= 0 && g.winner == null) g.winner = 1 - me; } },
  // Tope de daño (Demonio): en un turno tuyo no le podés sacar más de `cap` (lo que pasa se le devuelve)
  dmgCap: { text: (r) => `En un turno no le podés sacar más de ${r.cap}`, onTurnStart(g, me, r, info) { if (info.seat !== me) g.players[me].rs.tk = 0; },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me) return; const d = (info.wall || 0) + (info.castle || 0); const left = Math.max(0, r.cap - (p.rs.tk || 0)), over = Math.max(0, d - left); p.rs.tk = (p.rs.tk || 0) + d - over; if (!over) return; const bc = Math.min(over, info.castle || 0); p.castle += bc; p.wall += over - bc; info.castle -= bc; info.wall -= over - bc; info.fx.push('rule:dmgCap'); } },
  // Dolor (Demonio): cada carta que jugás te saca `amount` de castillo
  cardPain: { text: (r) => `Cada carta que jugás te saca ${r.amount} de castillo`, onCardPlayed(g, me, r, info) { if (info.seat === me) return; const o = g.players[1 - me]; o.castle = Math.max(0, o.castle - r.amount); info.fx.push('rule:pain'); if (o.castle <= 0 && g.winner == null) g.winner = me; } },
  // Renace (Demonio): la primera vez que llega a 0, vuelve con toda la vida (fx 'rule:reborn': la UI hace la cinemática)
  reborn: { text: () => 'La primera vez que cae, renace con toda la vida', onBattleStart(g, me) { g.players[me].rs.c0 = g.players[me].castle; },
    onDamage(g, me, r, info) { const p = g.players[me]; if (info.seat !== me || p.rs.reborn || p.castle > 0) return; p.rs.reborn = true; p.castle = p.rs.c0 || 60; p.rs.tk = 0; if (g.winner === 1 - me) g.winner = null; info.fx.push('rule:reborn'); } },
  // solo texto (la mecánica la hace el motor con los campos del enemigo)
  flyText: { text: (r) => `Vuela: recibe la mitad de daño hasta que le pegás ${r.hits} veces` },
  immuneText: { text: (r) => `Inmune a tus ${r.n} primeros efectos (robo, unidades)` },
  countdownText: { text: (r) => `Cuenta regresiva: a los ${r.turns} turnos explota (daño ${r.dmg}); si lo rompés antes, nada` },
  thornsText: { text: (r) => `Espinas ${r.n}: cada ataque tuyo te saca ${r.n} de muro` },
  enemyDrain: { text: (r) => `El rival empieza con −${r.amount} de cada recurso`, onBattleStart(g, me, r) { const o = g.players[1 - me]; for (const k of ['brick', 'weapon', 'crystal']) o[k] = Math.max(0, o[k] - r.amount); } },
};
// daño de regla (sin carta): primero al muro, lo que sobra al castillo; `direct` va derecho al castillo
function hit(q, dmg, direct) { q.wall -= dmg; if (q.wall < 0) { q.castle += q.wall; q.wall = 0; } q.castle = Math.max(0, q.castle - direct); }
// Regla demoníaca de cada rey (fase poseída, Juan 27/10): lo que hace desde que el demonio lo posee
export const DEMON_RULES = {
  humano: [{ k: 'curseEvery', every: 3, id: 192 }],                 // Aldric poseído: cada 3 turnos te mete Miedo en la mano (tus ataques −1). Medido: cada turno el jugador ganaba 12 %; así, 28 %
  enano: [{ k: 'regenWall', amount: 3 }],                            // Thorgrim: su muro se regenera +3 por turno (S03 10/11: era 6, las peleas no terminaban)
  orco: [{ k: 'lowCastleBonus', below: 999, amount: 4 }],           // Gorrak: todos sus ataques +4
  elfo: [{ k: 'costUp', res: 5, amount: 2 }],                        // Aelwyn: tus cartas de cristales cuestan 3 más
  gnomo: [{ k: 'dmgEvery', every: 2, amount: 5 }],                   // Fizzwick: cada 2 turnos una bomba, 5 directo al castillo
  drow: [{ k: 'curseEvery', every: 2, id: 194 }],                    // Vaelith: cada 2 turnos te mete Pánico (tus cartas cuestan 1 más). (S03 04/11: cada turno, con la aldea vacía casi nadie la pasaba)
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
// (S03 10/11, pedido de S10) Manga de campaña: cada rey liberado (aldea.seals) deja su As ("Ataque del rey") disponible para las runs
// siguientes. Va 1 en la manga, como en el PvP: el del rey elegido (pick) si está liberado; si no, el del último liberado.
export const sleeveOptions = (seals = []) => seals.filter((r) => MYTHIC_OF[r]).map((r) => ({ race: r, id: MYTHIC_OF[r] }));
export function sleeveFor(seals = [], pick = null) { const o = sleeveOptions(seals); return (o.find((x) => x.race === pick) || o.at(-1))?.id ?? null; }
// grietaSetup(tuRaza, razasLiberadas) → { rules: ayudas (sumalas a player.rules), mythics: ids de "Ataque del rey" de los OTROS reyes liberados
// (sumalas al mazo; al jugarlas entra el rey invitado: fx 'guestKing:<raza>', y tu rey no se desmaya) }
export function grietaSetup(race, freed = []) {
  return { rules: freed.map((r) => GRIETA_ALLIES[r]).filter(Boolean), mythics: freed.filter((r) => r !== race).map((r) => MYTHIC_OF[r]).filter(Boolean) };
}
// Equipo nuevo (cartas.md §5): ids de regla → se pasan en player.rules como { k: 'wallGloves' } etc. EQUIP_RULES lista los 15 con nombre y rareza.
export const EQUIP_RULES = ['colmilloArana', 'veloSombra', 'telarana', 'frascoSombra', 'pactoEterno', 'valvulaSeguridad', 'engrasador', 'engranajeMaestro', 'manometroLaton', 'calderaInestable', 'carcaj', 'plumaAguila', 'arcoLuna', 'cuerdaElfica', 'cuerdaPlata', 'collarColmillos', 'pinturaGuerra', 'tamborSangre', 'trofeoCampeon', 'ojosRojos', 'piedraAfilar', 'cuencoRunas', 'cincelRunico', 'yunqueEcos', 'coronaBasalto', 'wallGloves', 'goldBag', 'warHorn', 'leafTalisman', 'eternalGear', 'bloodCup', 'forestMantle', 'poisonVial', 'treasurerBag', 'runicAnvil', 'warCrown', 'stolenThrone', 'demonChalice', 'cartographer', 'watcherEye'];
export const ruleText = (r) => RULES[r.k]?.text(r) ?? r.k;
export function ruleHooks(rules = []) {
  const h = {};
  for (const name of ['onBattleStart', 'onTurnStart', 'onCardPlayed', 'onDamage', 'onKingAct']) {
    const rs = rules.filter((r) => typeof RULES[r.k]?.[name] === 'function'); if (!rs.length) continue;
    // r.eq = id del artefacto (lo pone el cliente): cuando actúa, fx 'eq:<id>' (al empezar la pelea siempre; en los otros, si el hook devuelve true)
    h[name] = (g, me, info) => { for (const r of rs) { const done = RULES[r.k][name](g, me, r, info); if (r.eq && (done || name === 'onBattleStart') && info.fx && !info.fx.includes('eq:' + r.eq)) info.fx.push('eq:' + r.eq); } };
  }
  return h;
}

/* ---------- enemigos de campaña: por raza y tier (T1 campamento, T2 guarnición, T3 élite, lor, rey) ---------- */
// { name, race, king, ai: 'facil'|'normal'|'dificil', hand, res, deck, rules }. Los mazos usan cartas normales + cartas de bicho (196-199).
const U = (bu, so, ma, b, w, cr, wall, castle) => ({ builder: bu, recruit: so, mage: ma, brick: b, weapon: w, crystal: cr, wall, castle });
// (S03 01/11, docs/campaña/enemigos.md) t1/t2/t3 son LISTAS: el cliente elige uno por nodo con la semilla del mapa y no repite el anterior;
// `rare: true` sale la mitad de veces. kind: 'castillo' | 'campamento' | 'bestia' | 'constructo' (cómo se dibuja, S10/S04).
// Bichos (bestia/constructo, y campamentos con acciones): noProd (no producen), pattern/patternLoop o weights (acciones de bicho 300-316,
// costo 0; la intención las muestra), capWall (empalizada con tope bajo; 0 = sin muro). minion: secuaz con vida propia (segundo muro).
const BUG = { race: null, king: false, ai: 'facil', hand: 2, plays: 1, noProd: true, deck: deckOf({ 300: 1 }) }; // base de los bichos (el mazo real lo arma `actions`)
const bug = (o) => ({ ...BUG, ...o, deck: deckOf(Object.fromEntries([...new Set([...(o.pattern || []), ...Object.keys(o.weights || {}).map(Number)])].map((id) => [id, 3]))) });
const SACERDOTISA = { name: 'Torre de la Sacerdotisa', hp: 10, heal: 1, atk: 1, rage: 1 }; // (doc: vida 18, cura 3: la pelea no terminaba, 40 % cortadas)
export const ENEMIES = {
  humano: {
    // (25/10, campaña con 2 jugadas por turno) plays = jugadas por turno del enemigo (1,5 = una y dos alternadas). Antes → ahora en docs/campaña/cartas.md
    t1: [
      { name: 'Campamento rebelde', tier: 1, kind: 'campamento', race: null, king: false, ai: 'facil', hand: 3, plays: 1, atk: 1, res: U(1, 2, 1, 4, 6, 2, 10, 45),
        deck: deckOf({ 196: 4, 1: 3, 2: 3, 6: 2, 34: 1 }), rules: [] },
      bug({ name: 'Saqueadores del camino', tier: 1, kind: 'campamento', atk: 3, res: U(1, 2, 1, 0, 8, 0, 5, 25), capWall: 10,
        pattern: [300, 300, 300, 301], rules: [{ k: 'steal', amount: 2 }, { k: 'flee', turn: 5 }] }),
      bug({ name: 'Sectarios del Abismo', tier: 1, kind: 'campamento', atk: 4, res: U(1, 2, 1, 0, 6, 0, 0, 45), capWall: 0,
        pattern: [302, 303, 303, 303, 304], patternLoop: 1, rules: [{ k: 'ritual', amount: 1 }] }),
      bug({ name: 'Ratas de la cloaca', tier: 1, kind: 'bestia', atk: 3, res: U(1, 1, 1, 0, 0, 0, 0, 60), capWall: 0,
        pattern: [305, 305, 306], rules: [{ k: 'swarm', every: 3, amount: 2 }, { k: 'curlOnce', amount: 4 }] }),
    ],
    t2: [
      { name: 'Guarnición del valle', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 1.5, atk: 0, res: U(1, 3, 1, 6, 10, 4, 12, 40),
        deck: deckOf({ 197: 4, 2: 3, 6: 3, 8: 1, 34: 1, 36: 1, 11: 1 }), rules: [] },
      bug({ name: 'Negreros', tier: 2, kind: 'campamento', atk: 0, res: U(1, 2, 1, 0, 8, 0, 10, 60), capWall: 15,
        pattern: [307, 307, 308], rules: [] }),
      bug({ name: 'Gusano de túnel', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 55), capWall: 0,
        weights: { 309: 50, 310: 25, 312: 25 }, rules: [{ k: 'burrow' }] }),
      { name: 'Compañía Gris', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 1.5, atk: 0, res: U(1, 3, 1, 6, 10, 4, 6, 24),
        deck: deckOf({ 197: 4, 2: 3, 6: 3, 8: 1, 36: 2 }), minion: SACERDOTISA, rules: [{ k: 'minion', ...SACERDOTISA }] },
    ],
    t3: [
      { name: 'Fortaleza de caballeros', tier: 3, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, atk: 1, res: U(1, 3, 1, 6, 12, 4, 30, 70),
        deck: deckOf({ 198: 4, 8: 3, 37: 2, 6: 3, 34: 1, 36: 1, 60: 1 }), rules: [{ k: 'bigHit', every: 2 }] },
      bug({ name: 'Ogro de las canteras', tier: 3, kind: 'campamento', res: U(1, 1, 1, 0, 0, 0, 0, 38), capWall: 0,
        pattern: [313, 314, 314, 315], rules: [{ k: 'buildRage', amount: 2 }] }),
      bug({ name: 'Libro maldito', tier: 3, kind: 'constructo', rare: true, res: U(1, 1, 1, 0, 0, 0, 10, 55), capWall: 10,
        pattern: [316], rules: [{ k: 'pages' }, { k: 'woundOnHit', id: 203 }] }),
    ],
    lor: { name: 'Lor Edmund, el Recaudador', tier: 4, kind: 'castillo', race: 'humano', king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(2, 1, 2, 8, 8, 6, 15, 55),   // (S03 10/11) 62/20 → 55/15: era el que más mataba al arrancar
      deck: deckOf({ 8: 2, 37: 2, 50: 1, 60: 2, 6: 2, 199: 2, 69: 2, 36: 1, 11: 1 }), rules: [{ k: 'tithe', every: 4, amount: 2, min: 2 }] },
    rey: { name: 'Rey Aldric', tier: 5, kind: 'castillo', race: 'humano', king: true, ai: 'dificil', hand: 4, plays: 1.5, atk: 1, res: U(2, 2, 2, 6, 6, 6, 10, 45),   // (S03 10/11) muro 15 → 10: con las peleas más cortas pasó a ser el que más mataba
      deck: deckOf({ 8: 2, 37: 1, 50: 1, 60: 1, 6: 2, 2: 2, 62: 1, 63: 1, 66: 1, 36: 1, 11: 1, 68: 1, 69: 1 }), rules: [{ k: 'startRes', amount: 2 }, possessRule('humano', 0.5)] }, // con la fase poseída arranca con +2 (antes +8)
  },
};
// Montañas de Thorgrim (S03 04/11, enemigos.md): defensa, muros, piedra
const TORRES = { name: 'Torres vigía', hp: 20, heal: 0, atk: 0, rage: 0 };
ENEMIES.enano = {
  t1: [
    bug({ name: 'Campamento minero', tier: 1, kind: 'campamento', atk: 0, res: U(1, 2, 1, 4, 6, 0, 5, 40), capWall: 15,
      pattern: [317, 317, 317], rules: [{ k: 'regenWall', amount: 3 }] }),
    bug({ name: 'Murciélagos de la mina', tier: 1, kind: 'bestia', atk: 2, res: U(1, 1, 1, 0, 0, 0, 0, 35), capWall: 0, fly: 3,
      pattern: [318], rules: [{ k: 'swarm', every: 3, amount: 2 }, { k: 'flyText', hits: 3 }] }),
    bug({ name: 'Gólem de escombros', tier: 1, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 8, 40), capWall: 20,
      pattern: [319, 320], rules: [{ k: 'regenWall', amount: 4 }] }),
    bug({ name: 'Contrabandistas de runas', tier: 1, kind: 'campamento', atk: 3, res: U(1, 2, 1, 0, 6, 4, 5, 30), capWall: 10,
      pattern: [300, 300, 300, 300, 301], rules: [{ k: 'steal', amount: 2, res: 'crystal' }, { k: 'flee', turn: 6 }] }),
  ],
  t2: [
    { name: 'Guarnición de la cuesta', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(2, 2, 1, 6, 6, 4, 15, 35), capWall: 25,
      deck: deckOf({ 197: 4, 2: 3, 6: 2, 36: 3, 41: 1, 38: 1 }), rules: [{ k: 'regenWall', amount: 1 }] },
    bug({ name: 'Oso de las cavernas', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 4, 0, 0, 0, 0, 45), capWall: 30,
      pattern: [322], rules: [{ k: 'sleep', turns: 3, id: 321 }] }),
    bug({ name: 'Torres vigía', tier: 2, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 40), capWall: 10, minion: TORRES,
      pattern: [324, 323, 323], rules: [{ k: 'minion', ...TORRES }] }),
    bug({ name: 'Esfera rúnica', tier: 2, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 20, 30), capWall: 20, immune: 3,
      pattern: [325, 326, 325, 331], rules: [{ k: 'immuneText', n: 3 }] }),
  ],
  t3: [
    bug({ name: 'Guardián de hierro', tier: 3, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 65), capWall: 40,
      pattern: [327, 327, 331], rules: [{ k: 'guardian', threshold: 20, thorns: 3, turns: 2, id: 328 }] }),
    bug({ name: 'Forja maldita', tier: 3, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 50), capWall: 10,
      pattern: [329, 329, 330], rules: [{ k: 'ritual', amount: 1 }] }),
  ],
  lor: { name: 'Lor Brakk, el Inamovible', tier: 4, kind: 'castillo', race: 'enano', king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(2, 1, 2, 10, 8, 6, 20, 60), capWall: 30,   // (S03 10/11) muro 25 → 20, tope 40 → 30, regenera 2 (era 3), menos cartas de muro: las peleas pasaban de 80 turnos
    deck: deckOf({ 73: 2, 75: 1, 76: 1, 134: 2, 37: 2, 38: 2, 8: 3, 6: 3, 36: 1 }), rules: [{ k: 'regenWall', amount: 2 }] },
  rey: { name: 'Rey Thorgrim', tier: 5, kind: 'castillo', race: 'enano', king: true, ai: 'dificil', hand: 4, plays: 1.5, res: U(2, 2, 2, 6, 6, 6, 15, 40), capWall: 25,   // (S03 10/11) tope de muro 35 → 25, rey cada 4 (era 3), poseído regenera 3 (era 6) y en la campaña no se cura con el rey
    deck: deckOf({ 73: 2, 76: 2, 134: 2, 37: 2, 8: 2, 6: 2, 2: 2, 79: 1, 38: 2 }), rules: [{ k: 'kingPeriod', period: 4 }, possessRule('enano', 0.5)] },
};
// Estepas de Gorrak (S03 04/11): ataque, furia, sangre
const DUENDES = { name: 'Pandilla de duendes', hp: 12, heal: 0, atk: 0, rage: 0 }, TOTEM = { name: 'Tótem de guerra', hp: 15, heal: 0, atk: 3, rage: 0 };
ENEMIES.orco = {
  t1: [
    bug({ name: 'Huargos', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 45), capWall: 0, pattern: [332], rules: [{ k: 'swarm', every: 3, amount: 1 }] }),
    bug({ name: 'Pandilla de duendes', tier: 1, kind: 'campamento', atk: 0, res: U(1, 2, 1, 0, 4, 0, 0, 30), capWall: 5, minion: DUENDES, pattern: [334, 334, 335], rules: [{ k: 'minion', ...DUENDES }] }),
    bug({ name: 'Chamán de sangre', tier: 1, kind: 'campamento', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 50), capWall: 0, pattern: [337], rules: [{ k: 'sacrifice', hp: 3, atk: 2 }] }),
    bug({ name: 'Saqueadores orcos', tier: 1, kind: 'campamento', atk: 1, res: U(1, 2, 1, 0, 8, 0, 5, 30), capWall: 10, pattern: [338, 338, 338, 301], rules: [{ k: 'steal', amount: 2, res: 'weapon' }, { k: 'flee', turn: 5 }] }),
  ],
  t2: [
    { name: 'Guarnición de colmillos', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, atk: 0, res: U(1, 3, 1, 4, 8, 2, 10, 40),
      deck: deckOf({ 197: 4, 2: 3, 6: 3, 8: 1, 36: 2 }), rules: [] },
    bug({ name: 'Jabalí de guerra', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 50), capWall: 0, pattern: [339, 339, 340], rules: [] }),
    bug({ name: 'Negreros de la estepa', tier: 2, kind: 'campamento', atk: 0, res: U(1, 2, 1, 0, 8, 0, 10, 55), capWall: 15, pattern: [341, 343, 308], rules: [] }), // (S03 09/11) un solo Látigo por vuelta y hasta 2 Miedos: con 3 Miedos el turno quedaba muerto
    bug({ name: 'Tótem de guerra', tier: 2, kind: 'campamento', atk: 0, res: U(1, 2, 1, 0, 6, 0, 5, 40), capWall: 10, minion: TOTEM, pattern: [343], rules: [{ k: 'minion', ...TOTEM }] }),
  ],
  t3: [
    { name: 'Campeón de la arena', tier: 3, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 1, 6, 12, 4, 20, 60),
      deck: deckOf({ 198: 2, 8: 3, 6: 3, 2: 3, 36: 2, 34: 1 }), rules: [{ k: 'execute' }] },
    bug({ name: 'Bruto', tier: 3, kind: 'campamento', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 45), capWall: 0, pattern: [313, 314, 314, 315], rules: [{ k: 'buildRage', amount: 3 }] }),
  ],
  // (S03 10/11) era la pared de todas las razas: castillo 60 → 50, muro 15 → 10, furia cada 2 ataques tuyos (era cada uno), sin la pasiva orca del PvP
  lor: { name: 'Lor Ugrak, el Rabioso', tier: 4, kind: 'castillo', race: 'orco', king: false, ai: 'normal', hand: 3, plays: 1.5, noPassive: true, res: U(1, 2, 1, 6, 10, 4, 10, 38),
    deck: deckOf({ 112: 2, 114: 2, 115: 2, 117: 2, 145: 2, 119: 2, 8: 2, 6: 2, 36: 1 }), rules: [{ k: 'enrage', amount: 1, every: 2 }] },
  rey: { name: 'Rey Gorrak', tier: 5, kind: 'castillo', race: 'orco', king: true, ai: 'dificil', hand: 4, plays: 1.5, res: U(2, 2, 2, 6, 8, 6, 15, 48),
    deck: deckOf({ 112: 2, 114: 2, 117: 2, 145: 2, 147: 1, 119: 2, 178: 1, 8: 2, 6: 2, 36: 1 }), rules: [{ k: 'lowCastleBonus', below: 25, amount: 2 }, possessRule('orco', 0.5)] },
};
// Bosque de Aelwyn (S03 04/11): cartas, magia, naturaleza
ENEMIES.elfo = {
  t1: [
    bug({ name: 'Halcones del claro', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 35), capWall: 0, fly: 3, pattern: [346, 346, 347], rules: [{ k: 'flyText', hits: 3 }] }),
    bug({ name: 'Hongo de pantano', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 40), capWall: 0, pattern: [348, 348, 349], rules: [{ k: 'spores' }] }),
    bug({ name: 'Exploradores', tier: 1, kind: 'campamento', atk: 0, res: U(1, 2, 1, 0, 6, 0, 5, 35), capWall: 10, pattern: [350, 350, 324], rules: [] }),
    bug({ name: 'Dríade espinosa', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 40), capWall: 0, thorns: 2, pattern: [351], rules: [{ k: 'thornsText', n: 2 }] }),
  ],
  t2: [
    { name: 'Guarnición del claro', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(1, 3, 2, 4, 6, 4, 10, 35),
      deck: deckOf({ 197: 4, 2: 3, 6: 2, 19: 1, 36: 2 }), rules: [{ k: 'costUp', res: 5, amount: 1 }] },
    bug({ name: 'Planta carnívora', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 50), capWall: 20, pattern: [352], rules: [{ k: 'malleable', start: 1, max: 4 }] }), // (S03 10/11) tope de muro 40 → 20 y cada golpe le da hasta 4
    bug({ name: 'Ent corrompido', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 60), capWall: 0, pattern: [354, 354, 353], rules: [{ k: 'regenCastle', amount: 2 }] }), // (S03 09/11) 65/3 por turno → 60/2: era la T2 elfa que más mataba
    bug({ name: 'Ilusionista', tier: 2, kind: 'campamento', atk: 0, res: U(1, 1, 2, 0, 0, 6, 5, 45), capWall: 10, pattern: [359, 355, 359], rules: [] }),
  ],
  t3: [
    bug({ name: 'Serpiente del lago', tier: 3, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 55), capWall: 0, pattern: [356, 357], rules: [{ k: 'intangibleEvery', id: 356 }] }),
    bug({ name: 'Arquera corrompida', tier: 3, kind: 'castillo', atk: 0, res: U(1, 2, 2, 0, 6, 6, 10, 45), capWall: 15, pattern: [358], rules: [{ k: 'pages' }, { k: 'curseEvery', every: 3, id: 192 }] }),
  ],
  lor: { name: 'Lor Faelar, el Vidente', tier: 4, kind: 'castillo', race: 'elfo', king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(1, 2, 2, 4, 6, 6, 10, 45),
    deck: deckOf({ 83: 2, 85: 2, 137: 1, 2: 3, 6: 2, 19: 1, 36: 2, 86: 1, 11: 1 }), rules: [{ k: 'costUp', res: 5, amount: 1 }] },
  rey: { name: 'Rey Aelwyn', tier: 5, kind: 'castillo', race: 'elfo', king: true, ai: 'dificil', hand: 4, plays: 1.5, res: U(2, 2, 2, 6, 6, 6, 10, 45),
    deck: deckOf({ 83: 2, 85: 2, 88: 1, 137: 2, 2: 3, 6: 2, 19: 1, 36: 2, 11: 1 }), rules: [possessRule('elfo', 0.5)] },
};
// Talleres de Fizzwick (S03 04/11): máquinas, trampas, vapor
const CATAPULTA = { name: 'Catapulta', hp: 12, heal: 0, atk: 2, rage: 0 }, ORBES = { name: 'Orbes', hp: 14, heal: 0, atk: 0, rage: 0 };
ENEMIES.gnomo = {
  t1: [
    bug({ name: 'Chatarreros', tier: 1, kind: 'campamento', atk: 1, res: U(1, 2, 1, 6, 4, 0, 5, 30), capWall: 10, pattern: [300, 300, 300, 301], rules: [{ k: 'steal', amount: 2, res: 'brick' }, { k: 'flee', turn: 5 }] }),
    bug({ name: 'Polvorín', tier: 1, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 30), capWall: 0, pattern: [360, 361, 362], rules: [{ k: 'countdownText', turns: 3, dmg: 25 }] }),
    bug({ name: 'Torreta de vapor', tier: 1, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 6, 35), capWall: 12, pattern: [363], rules: [{ k: 'regenWall', amount: 3 }] }),
    bug({ name: 'Ratas de engranaje', tier: 1, kind: 'bestia', atk: 2, res: U(1, 1, 1, 0, 0, 0, 0, 55), capWall: 0, pattern: [364, 364, 365], rules: [{ k: 'swarm', every: 3, amount: 2 }] }),
  ],
  t2: [
    { name: 'Guarnición a vapor', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 2, res: U(2, 2, 1, 6, 6, 4, 10, 35),
      deck: deckOf({ 197: 4, 2: 3, 6: 2, 36: 2, 11: 1 }), rules: [{ k: 'startTrap', trap: 'ambush' }] },
    bug({ name: 'Tortuga de asedio', tier: 2, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 6, 40), capWall: 20, pattern: [366, 366, 331], rules: [{ k: 'plates', n: 6 }] }),
    bug({ name: 'Ingenieros', tier: 2, kind: 'campamento', atk: 0, res: U(1, 2, 1, 4, 4, 0, 5, 40), capWall: 10, minion: CATAPULTA, pattern: [367], rules: [{ k: 'minion', ...CATAPULTA }] }),
    bug({ name: 'Gólem de latón', tier: 2, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 50), capWall: 10, pattern: [319, 368], rules: [] }),
  ],
  t3: [
    bug({ name: 'Autómata de bronce', tier: 3, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 55), capWall: 10, minion: ORBES, pattern: [363, 363, 369], rules: [{ k: 'minion', ...ORBES }, { k: 'stasis' }] }),
    bug({ name: 'Reloj del tiempo', tier: 3, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 55), capWall: 10, pattern: [372], rules: [{ k: 'timeEater', every: 8, atk: 2 }] }),
  ],
  // (S03 09/11) Tinkle mataba más que Fizzwick (46 a 33): castillo 55 → 45, sin +1 de ataque, trampa nueva cada 5 turnos (era 4)
  lor: { name: 'Lor Tinkle, el Trampero', tier: 4, kind: 'castillo', race: 'gnomo', king: false, ai: 'normal', hand: 3, plays: 1.5, atk: 0, res: U(2, 2, 1, 8, 8, 4, 15, 45),
    deck: deckOf({ 102: 2, 103: 2, 107: 2, 108: 2, 109: 2, 2: 2, 6: 2, 36: 1 }), rules: [{ k: 'startTrap', trap: 'moat' }, { k: 'trapEvery', every: 5, traps: ['moat', 'ambush', 'counterspell', 'landmine'] }] },
  rey: { name: 'Rey Fizzwick', tier: 5, kind: 'castillo', race: 'gnomo', king: true, ai: 'dificil', hand: 4, plays: 1.5, atk: 2, res: U(2, 2, 2, 6, 6, 6, 15, 50),
    deck: deckOf({ 102: 2, 103: 2, 107: 2, 108: 2, 109: 2, 2: 2, 6: 2, 36: 1, 105: 1 }), rules: [possessRule('gnomo', 0.5)] },
};
// Cavernas de Vaelith (S03 04/11): control, maldiciones, sombra
const SOMBRAS = { name: 'Sombras', hp: 15, heal: 0, atk: 3, rage: 0 }, ANTORCHAS = { name: 'Antorchas', hp: 12, heal: 0, atk: 1, rage: 0 };
ENEMIES.drow = {
  t1: [
    bug({ name: 'Arañas de la caverna', tier: 1, kind: 'bestia', atk: 1, res: U(1, 1, 1, 0, 0, 0, 0, 40), capWall: 0, pattern: [373, 373, 374], rules: [{ k: 'swarm', every: 3, amount: 1 }] }),
    bug({ name: 'Sombras', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 25), capWall: 0, minion: SOMBRAS, pattern: [375], rules: [{ k: 'minion', ...SOMBRAS }, { k: 'revive', turns: 2 }] }),
    bug({ name: 'Acólitos de la Grieta', tier: 1, kind: 'campamento', atk: 0, res: U(1, 1, 1, 0, 0, 4, 0, 40), capWall: 0, pattern: [303], rules: [{ k: 'ritual', amount: 1 }, { k: 'curseEvery', every: 3, id: 192 }] }),
    bug({ name: 'Ladrones de favor', tier: 1, kind: 'campamento', atk: 1, res: U(1, 2, 1, 0, 6, 4, 5, 30), capWall: 10, pattern: [300, 300, 300, 301], rules: [{ k: 'steal', amount: 1, res: 'favor' }, { k: 'steal', amount: 1 }, { k: 'flee', turn: 5 }] }),
  ],
  t2: [
    // (S03 09/11) las T2 drow mataban más que Lor y Reina: Guarnición y Coleccionista 1,5 jugadas, Elegida 60 → 50 y sin +1, Antorchas 16/+2 → 12/+1
    { name: 'Guarnición del abismo', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 1.5, atk: 0, res: U(1, 2, 2, 4, 6, 6, 10, 25),
      deck: deckOf({ 197: 3, 196: 2, 2: 3, 6: 2, 92: 1, 36: 2 }), rules: [{ k: 'curseEvery', every: 3, id: 194 }] },
    bug({ name: 'Elegida', tier: 2, kind: 'campamento', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 50), capWall: 0, pattern: [384, 385, 386], patternLoop: 1, rules: [{ k: 'hex', id: 384 }] }),
    bug({ name: 'Masa de telaraña', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 55), capWall: 30, weights: { 377: 25, 378: 45, 379: 30 }, rules: [{ k: 'reactive' }, { k: 'runCurse', id: 377, curse: 190 }] }),
    { name: 'Coleccionista', tier: 2, kind: 'castillo', race: null, king: false, ai: 'normal', hand: 3, plays: 1.5, res: U(1, 2, 1, 4, 6, 4, 10, 35),
      deck: deckOf({ 196: 4, 197: 3, 2: 2, 6: 2, 36: 2 }), minion: ANTORCHAS, rules: [{ k: 'minion', ...ANTORCHAS }, { k: 'curseEvery', every: 5, ids: [192, 194, 193] }] },
  ],
  t3: [
    bug({ name: 'Némesis', tier: 3, kind: 'bestia', atk: 2, res: U(1, 1, 1, 0, 0, 0, 0, 75), capWall: 0, pattern: [380, 381], rules: [{ k: 'intangibleEvery', id: 380 }] }),
    bug({ name: 'Domadora', tier: 3, kind: 'campamento', atk: 1, res: U(1, 1, 1, 0, 0, 0, 5, 70), capWall: 10, pattern: [382, 383, 383, 383], rules: [{ k: 'daggers', id: 382, hp: 14, turns: 3, dmg: 24 }] }),
  ],
  lor: { name: 'Lor Zhar, el Maldito', tier: 4, kind: 'castillo', race: 'drow', king: false, ai: 'normal', hand: 3, plays: 1.5, atk: 1, res: U(1, 2, 2, 6, 6, 8, 15, 62), /* (S03 09/11) 55 → 62: con las T2 más blandas, el Lor tiene que ser el escalón */
    deck: deckOf({ 92: 1, 93: 2, 94: 1, 99: 2, 140: 2, 197: 2, 2: 2, 6: 2, 36: 1 }), rules: [{ k: 'curseEvery', every: 2, id: 194 }] },
  rey: { name: 'Reina Vaelith', tier: 5, kind: 'castillo', race: 'drow', king: true, ai: 'dificil', hand: 4, plays: 1.5, atk: 2, res: U(2, 2, 2, 6, 6, 6, 15, 50),
    deck: deckOf({ 92: 2, 93: 2, 99: 2, 100: 1, 140: 2, 141: 1, 174: 1, 2: 2, 6: 2, 36: 1 }), rules: [possessRule('drow', 0.5)] },
};
// La Grieta (S03 04/11): 5 pisos, todo corrupto. El Heraldo (lor) copia la regla del último Lor vencido: heraldoFor(reino)
ENEMIES.grieta = {
  t1: [
    bug({ name: 'Lodos', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 44), capWall: 0, pattern: [387, 387, 388], rules: [{ k: 'split', atk: 2 }] }),
    bug({ name: 'Masa retorcida', tier: 1, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 50), capWall: 20, weights: { 389: 45, 390: 25, 379: 30 }, rules: [{ k: 'reactive' }, { k: 'runCurse', id: 390, curse: 191 }] }),
  ],
  t2: [
    // (S03 10/11) sin la ayuda de los reyes en el camino, las T2 de la Grieta se bajan un poco (Lodos ganaba 21 %)
    bug({ name: 'Masa retorcida', tier: 2, kind: 'bestia', atk: 1, res: U(1, 1, 1, 0, 0, 0, 0, 60), capWall: 30, weights: { 389: 45, 390: 25, 379: 30 }, rules: [{ k: 'reactive' }, { k: 'runCurse', id: 390, curse: 191 }] }),
    bug({ name: 'Espectro', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 999), capWall: 0, pattern: [391], rules: [{ k: 'endure', turns: 4, max: 9 }] }),
    bug({ name: 'Lodos', tier: 2, kind: 'bestia', atk: 0, res: U(1, 1, 1, 0, 0, 0, 0, 48), capWall: 0, pattern: [387, 387, 388], rules: [{ k: 'split', atk: 2 }] }),
  ],
  t3: [
    bug({ name: 'Cabeza de piedra', tier: 3, kind: 'constructo', atk: 0, res: U(1, 1, 1, 0, 0, 0, 10, 80), capWall: 20, pattern: [392, 392, 393], rules: [{ k: 'comboVuln', amount: 3 }] }),
  ],
  lor: null, // se arma con heraldoFor(último reino liberado)
  rey: bug({ name: 'El Demonio', tier: 5, kind: 'bestia', ai: 'dificil', atk: -2, res: U(1, 1, 1, 0, 0, 0, 10, 60), capWall: 30, pattern: [394, 395, 396],
    rules: [{ k: 'dmgCap', cap: 30 }, { k: 'reborn' }, { k: 'cardPain', amount: 1 }, { k: 'curseEvery', every: 4, ids: [193, 194, 195, 204, 205] }] }),
};
export function heraldoFor(reino = 'drow') { const l = ENEMIES[reino]?.lor || ENEMIES.drow.lor; return { ...l, name: 'Heraldo del demonio', race: null, rules: (l.rules || []).map((r) => ({ ...r })) }; }
ENEMIES.grieta.lor = heraldoFor('drow');
export const BOSS_LOOT = { humano: [200, 201] };
// Compatibilidad: ENEMY_POOL es ENEMIES (las listas). enemyFor(reino, tier, rnd) elige uno (los `rare` pesan la mitad).
export const ENEMY_POOL = ENEMIES;
export const enemyList = (reino, tier) => { const e = ENEMIES[reino]?.[tier]; return e == null ? [] : Array.isArray(e) ? e : [e]; };
export function enemyFor(reino, tier, rnd = Math.random) { const l = enemyList(reino, tier); if (!l.length) return null; const w = l.map((x) => (x.rare ? 0.5 : 1)), t = w.reduce((a, b) => a + b, 0); let q = rnd() * t; for (let i = 0; i < l.length; i++) if ((q -= w[i]) < 0) return l[i]; return l[l.length - 1]; }

/* ---------- armar una pelea ---------- */
// player = { deck, hand, res, race, rules (equipo), king }; enemy = una entrada de ENEMIES. Devuelve el juego; el jugador es el asiento 0, el enemigo el 1.
// Además (25/10): player.plays (jugadas por turno, por defecto CAMPAIGN.plays; el Salón de guerra suma), player.gold (oro de la run), player.kills
// (enemigos vencidos en la run: Banquete), player.grow ({ id: n } lo que ya creció cada carta "Crece"), player.works (ids de Obras que
// quedaron de la pelea anterior: solo con Engranaje eterno), player.maxCastle (vida máxima: Berserker de sangre).
// (S03 10/11, pedido de S10: la run completa en ~2 h) vida y muro de los enemigos según su tier, para peleas más cortas
export const FIGHT_LEN = { hp: { 1: 0.6, 2: 0.55, 3: 0.7, 4: 0.65, 5: 0.7 } };   // medido con camp_sts (con el enfurecimiento): la run ganada pasó de ~600-800 a ~325 turnos tuyos (~2 h 15)
const shortRes = (e) => { const m = FIGHT_LEN.hp[e.tier] ?? 1; if (m === 1 || !e.res) return e.res; return { ...e.res, castle: e.res.castle >= 900 ? e.res.castle : Math.max(5, Math.round(e.res.castle * m)), wall: Math.round((e.res.wall || 0) * m) }; };
export function makeBattle(player, enemy, { starter = 0, rnd = Math.random } = {}) {
  const pr = player.rules || [], er = enemy.rules || [];
  const sum = (k) => pr.reduce((a, r) => a + (RULES[r.k]?.[k] || 0), 0); // equipo que cambia jugadas/mano (Corona de guerra, Ojo del vigía)
  const keepWorks = pr.some((r) => RULES[r.k]?.keepWorks);
  const g = E.newGame({
    starter, rnd, campaign: { noWin100: true, baseProd: CAMPAIGN.baseProd },
    seats: [
      { deck: player.deck, hand: Math.max(1, (player.hand ?? PLAYER_START.hand) + sum('hand')), res: { ...PLAYER_START.res, ...(player.res || {}) }, race: player.race || 'humano', king: player.king !== false, hooks: ruleHooks(pr), rules: pr,
        plays: (player.plays ?? CAMPAIGN.plays) + sum('plays'), discardHand: player.discardHand ?? CAMPAIGN.discardHand, gold: player.gold || 0, kills: player.kills || 0, grow: player.grow || {}, works: keepWorks ? player.works || [] : [], maxCastle: player.maxCastle ?? player.res?.castle ?? PLAYER_START.res.castle },
      { deck: enemy.deck, hand: enemy.hand, res: shortRes(enemy), race: enemy.race, king: !!enemy.king, hooks: ruleHooks(er), rules: er, plays: enemy.plays || 1, discardHand: !!enemy.discardHand, ...(enemy.capWall != null ? { capWall: enemy.capWall } : {}), noProd: !!enemy.noProd, atk: enemy.atk || 0, pattern: enemy.pattern || null, patternLoop: enemy.patternLoop || 0, weights: enemy.weights || null, minion: enemy.minion || null, fly: enemy.fly || 0, immune: enemy.immune || 0, thorns: enemy.thorns || 0 },
    ],
  });
  g.enemy = { name: enemy.name, tier: enemy.tier, ai: enemy.ai, kind: enemy.kind || 'castillo', rules: er.map((r) => ({ ...r, text: ruleText(r) })) };
  for (const id of player.startStates || []) E.giveCard(g, g.players[0], id); // estados que trae de la pelea anterior (esporas → Vulnerable)
  if (enemy.pattern || enemy.weights) E.bugNext(g, g.players[1]); /* la primera acción queda elegida (la intención y la jugada coinciden) */
  if (player.sleeve != null) g.players[0].sleeve = player.sleeve; // (S03 10/11) manga de campaña: el As de un rey liberado (se juega una vez por pelea, pagando +1 de cada recurso)
  if (CAMP_RACE[g.players[0].race]?.noPassive) g.players[0].noPassive = true;
  if (enemy.noPassive) g.players[1].noPassive = true;
  if (CAMP_RACE[g.players[0].race]?.noKing) g.players[0].noKing = true;
  if (CAMP_RACE[g.players[0].race]?.humanPassive) g.players[0].basePassive = true; // sostén de la campaña: recurso más bajo +1 y muro +1 (como el humano)
  if (CAMP_RACE[g.players[0].race]?.aim) g.players[0].aimOn = true;
  if (CAMP_RACE[g.players[0].race]?.pact) g.players[0].pactOn = true;
  if (g.players[0].venomStart) E.campVenom(g.players[1], g.players[0].venomStart); // Madre araña (Crece)
  if (CAMP_RACE[g.players[0].race]?.boiler) { g.players[0].boilerOn = true; g.players[0].pressure ||= 0; }
  if (CAMP_RACE[g.players[0].race]?.fury) { g.players[0].furyOn = true; g.players[0].fury ||= 0; } // el orco de campaña juega a la Furia (antes de las reglas de equipo: Pintura de guerra la sube) // (S03 08/11) el enano de campaña juega a las runas: sin la pasiva del PvP (muro +2)
  g.players[1].campTurns ??= 0; // enfurecimiento (E.ENRAGE): la vista ya muestra cuánto falta
  g.rules = [pr, er];
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
  const pv = c.players[1 - enemy], pre = [pv.castle, pv.wall], tev = E.endTurn(c); if (c.winner != null || c.turn !== enemy) return null;
  const p = c.players[enemy], o = c.players[1 - enemy];
  // (S03 10/11, pedido de S10) el rey que actúa al empezar su turno también se anuncia (Thorgrim/Fizzwick sacaban 20 en dos turnos sin aviso)
  const kingHit = tev?.king ? { dmg: Math.max(0, pre[0] - o.castle) + Math.max(0, pre[1] - o.wall), race: p.race } : null;
  E.aiMaybeCycle(c);
  const m = E.aiChooseLevel(c, level, rnd);
  const it = { seat: enemy, turnNo: c.turnNo, type: m.type, card: null, name: null, kind: 'other', dmg: 0, direct: 0, wall: 0, castle: 0, text: 'Descarta' };
  if (m.type === 'play') {
    const id = p.hand[m.index]; it.card = id; it.name = NAMES[id][0];
    const { s, op } = E.cardVectors(c, p, o, id);
    it.dmg = op[6]; it.direct = op[7]; it.wall = s[6]; it.castle = s[7];
    const k = FX[id]?.k;
    if (op[6] + op[7] > 0) { it.kind = 'attack'; it.text = op[7] ? `Ataca ${op[6] + op[7]} (${op[7]} directo)` : `Ataca ${op[6]}`; }
    else if (k === 'bug' && FX[id].intent) { it.kind = FX[id].kind || 'effect'; it.text = FX[id].intent; } // acción de bicho sin daño (enemigos.md)
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
  if (it.card != null && FX[it.card]?.k === 'bug') { const sp = FX[it.card]; // acciones de bicho con daño: golpes de Página y lo que te mete
    if (sp.pages || sp.hits > 1) { const n = sp.pages ? Math.max(1, p.pageHits || 1) : sp.hits; it.text = `Ataca ${n} × ${it.dmg}`; it.dmg *= n; }
    if (sp.give && it.kind === 'attack') it.text += ` y te mete ${NAMES[sp.give][0]}`; }
  { const pl = g.players[g.turn]; if (pl.hand.includes(195)) { if (pl.seeIntentAlways) {} else if (pl.seeIntent > 0) pl.seeIntent--; else it.hidden = true; } } // estado Humo: la UI no la muestra (la IA igual la cumple); Espía de la corte / Ojo del vigía la dejan ver
  if (kingHit) { it.king = kingHit; it.text = (kingHit.dmg > 0 ? `¡Su rey actúa (${kingHit.dmg} de daño)! ` : '¡Su rey actúa! ') + it.text; }
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
  const curses = (g.players[1 - seat]?.rs?.rcs || '').split(',').filter(Boolean).map(Number); /* Masa de telaraña / retorcida: maldiciones que quedan en el mazo de la run (S10: addCurse) */
  const fled = !!g.fled, carry = g.winner === seat && (g.rules?.[1 - seat] || []).some((r) => r.k === 'spores') ? [205] : []; // esporas: la próxima pelea empezás con Vulnerable (player.startStates) // el enemigo huyó (Saqueadores): ganás, pero el cliente no da oro de recompensa
  const heal = g.winner === seat && !p.noHeal ? (p.furyOn ? Math.round((p.bloodPaid || 0) * E.FURY_CFG.bloodBack) + E.FURY_CFG.healWin : 0) + (p.pactOn ? E.VENOM_CFG.healWin : 0) : 0; /* (S03 08/11) orco, Sangre caliente: al ganar recuperás la vida que pagaste con cartas de sangre */
  return { win: g.winner === seat, fled, noGold: fled, carry, curses, ...(p.hpMaxUp ? { hpMaxUp: p.hpMaxUp } : {}), castle: Math.min(p.maxCastle || 999, p.castle + heal), ...(heal ? { healed: heal } : {}), wall: p.wall, gold, goldGained: gold - (p.goldStart || 0), grown, works: (p.works || []).map((w) => w.id), burned: (p.burned || []).slice(), kills: g.winner === seat ? 1 : 0 };
}
// Para S10: la versión + de una carta (fogata, eventos, dorada) y sus datos de recompensa
export { CAMP_INFO, CAMP_IDS, PLUS, plusOf, baseOf, isPlus, hasPlus } from './campaign-cards.js';
