// Cartas solo de campaña (ids 200+; 190-195 son las míticas del PvP, 196-199 reservados). No entran en el PvP: NCARDS sigue en 179; el total con estas es NCARDS_ALL (cards.js).
// Formato igual al de races.js: [nombre, texto, costo, propio, rival, efecto especial]
// Tipos (FX.k): 'curse' = maldición (no se juega, no se descarta, ocupa la mano; se saca en fogata/mercader/templo);
//               'state' = estado (igual que la maldición pero desaparece al terminar tu turno);
//               'giveCurse' = carta de bicho que te mete una maldición/estado; 'loot' marca botín de rey (cartas normales).
const Z = [0, 0, 0, 0, 0, 0, 0, 0];
const c = (b = 0, w = 0, cr = 0) => [0, b, 0, w, 0, cr, 0, 0];
const s = ({ b = 0, w = 0, cr = 0, bu = 0, so = 0, ma = 0, wall = 0, castle = 0 } = {}) => [bu, b, so, w, ma, cr, wall, castle];
const o = ({ b = 0, w = 0, cr = 0, bu = 0, so = 0, ma = 0, dmg = 0, direct = 0 } = {}) => [bu, b, so, w, ma, cr, dmg, direct];
export const CAMPAIGN_CARDS = {
  // Maldiciones (190-192)
  190: ['Plaga de ratas', 'Maldición: no se juega ni se descarta; ocupa un lugar en tu mano', Z, Z, Z, { k: 'curse' }],
  191: ['Deuda', 'Maldición: no se juega ni se descarta; al empezar tu turno perdés 1 ladrillo', Z, Z, Z, { k: 'curse', tick: [0, -1, 0, 0, 0, 0, 0, 0] }],
  192: ['Miedo', 'Maldición: no se juega ni se descarta; mientras esté en tu mano tus ataques hacen 1 menos', Z, Z, Z, { k: 'curse' }],
  // Estados (193-195): los mete el enemigo, se van al terminar tu turno
  193: ['Brecha', 'Estado: mientras esté en tu mano tus cartas de muro dan la mitad; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  194: ['Pánico', 'Estado: mientras esté en tu mano tus cartas cuestan 1 más; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  195: ['Humo', 'Estado: no ves la intención del enemigo; desaparece al terminar tu turno', Z, Z, Z, { k: 'state', blind: true }],
  // Cartas de bicho (196-199): las usan los enemigos de campaña
  196: ['Antorcha', 'Daño 4', c(0, 2), Z, o({ dmg: 4 })],
  197: ['Flecha de guarnición', 'Daño 7 y muro +2', c(0, 5), s({ wall: 2 }), o({ dmg: 7 })],
  198: ['Carga de caballeros', 'Daño 16', c(0, 12), Z, o({ dmg: 16 })],
  199: ['Cultista', 'Le metés una Plaga de ratas en la mano al rival', c(0, 0, 5), Z, Z, { k: 'giveCurse', id: 190 }],
  // Botín de rey (200-201): Aldric
  200: ['Corona de Aldric', 'Castillo +10 y +3 de cada recurso', c(8), s({ castle: 10, b: 3, w: 3, cr: 3 }), Z, { k: 'loot', king: 'humano' }],
  201: ['Tesorería real', 'Ladrillos +6, armas +6, cristales +6', c(0, 0, 4), s({ b: 6, w: 6, cr: 6 }), Z, { k: 'loot', king: 'humano' }],
};
export const CURSE_IDS = [190, 191, 192];
export const STATE_IDS = [193, 194, 195];

/* ===================== Campaña estilo Slay the Spire (Juan 25/10): 75 cartas 210-284 + su versión mejorada (+) =====================
   docs/campaña/cartas.md. Cada carta trae FX[id].camp (ver engine.js, bloque "Campaña estilo Slay the Spire"): palabras clave (kw),
   costo en oro, condiciones, efecto según el estado (dyn), efecto después (after), Obra (work), Crece (start/end).
   La versión + es id + 1000 (PLUS): mismo nombre con "+", su propio texto y números (x.plus = true en los handlers). */
export const PLUS = 1000;
const cf = (b = 0, w = 0, cr = 0, f = 0) => [0, b, 0, w, 0, cr, 0, 0, f];
const blood = (n) => [0, 0, 0, 0, 0, 0, 0, n]; // se paga con castillo (orcos)
const free = [0, 0, 0, 0, 0, 0, 0, 0];
export const CAMP_INFO = {}; // id base → { race, rar: 'comun'|'poco'|'rara', kw: [...] }
export const CAMP_RAPID = new Set();
const KWT = { quema: 'Se quema', guardada: 'Guardada', mano: 'De mano' };
// def(id, nombre, raza, rareza, { cost, s, o, text, plusText, kw, rapid, camp, plus: { cost, s, o, camp } })
function def(id, name, race, rar, d) {
  const kw = d.kw || [];
  const tx = (t, k) => [t, ...k.filter((x) => KWT[x]).map((x) => KWT[x])].join('. ');
  const mk = (pid, plus) => {
    const P = plus ? d.plus || {} : {}; const k = plus && P.kw ? P.kw : kw;
    const camp = { ...(d.camp || {}), ...(P.camp || {}), kw: k };
    CAMPAIGN_CARDS[pid] = [name + (plus ? '+' : ''), tx(plus ? d.plusText : d.text, k), P.cost || d.cost || free, P.s || d.s || Z, P.o || d.o || Z, { k: d.curse ? 'curse' : 'camp', camp, ...(plus ? { plus: true, base: id } : {}) }];
    if (d.rapid) CAMP_RAPID.add(pid);
  };
  mk(id, false); mk(id + PLUS, true); CAMP_INFO[id] = { race, rar, kw };
}
const ST = new Set([193, 194, 195]); // estados
const pick = (x, a, b) => (x.plus ? b : a);

/* ---------- Humanos: el Oro ---------- */
def(210, 'Mercenarios', 'humano', 'comun', { cost: c(0, 6), text: 'Daño igual a tu oro ÷ 7 (mínimo 4)', plusText: 'Daño igual a tu oro ÷ 5 (mínimo 5)',
  camp: { dyn: (x) => { x.op[6] = Math.max(pick(x, 4, 5), Math.floor((x.p.gold || 0) / pick(x, 7, 5))); } } });
def(211, 'Recaudación', 'humano', 'comun', { cost: c(4), kw: ['quema'], text: '+8 de oro de la run', plusText: '+12 de oro de la run',
  camp: { after: (x) => { x.p.gold += pick(x, 8, 12); } } });
def(212, 'Leva pagada', 'humano', 'comun', { s: s({ so: 1 }), text: 'Cuesta 15 de oro. Soldados +1 (esta pelea)', plusText: 'Cuesta 10 de oro. Soldados +1 (esta pelea)',
  camp: { gold: 15 }, plus: { camp: { gold: 10 } } });
def(213, 'Arcas reales', 'humano', 'poco', { cost: c(0, 0, 8), text: 'Castillo +1 por cada 15 de oro', plusText: 'Castillo +1 por cada 10 de oro',
  camp: { dyn: (x) => { x.s[7] = Math.floor((x.p.gold || 0) / pick(x, 15, 10)); } } });
def(214, 'Soborno de guardia', 'humano', 'poco', { text: 'Cuesta 20 de oro. El próximo ataque enemigo hace la mitad', plusText: 'Cuesta 12 de oro. El próximo ataque enemigo hace la mitad',
  camp: { gold: 20, after: (x) => { x.p.halfNext = true; } }, plus: { camp: { gold: 12 } } });
def(215, 'Inversión', 'humano', 'poco', { cost: c(6), kw: ['obra'], text: 'Obra: +3 de oro al empezar cada turno tuyo', plusText: 'Obra: +5 de oro al empezar cada turno tuyo',
  camp: { work: { value: 4, tick: (x) => { x.p.gold += Math.round(pick(x, 3, 5) * x.mult); } } } });
def(216, 'Estandarte del reino', 'humano', 'comun', { cost: c(5), s: s({ wall: 7 }), text: 'Muro +7; tu próximo ataque este turno hace +3', plusText: 'Muro +10; tu próximo ataque este turno hace +3',
  camp: { after: (x) => { x.p.nextAtk += 3; } }, plus: { s: s({ wall: 10 }) } });
def(217, 'Banco de la corona', 'humano', 'rara', { cost: c(4), kw: ['crece'], text: '+5 de oro. Crece: +1 de oro por cada pelea que termines con ella en el mazo', plusText: '+8 de oro. Crece: +1 de oro por cada pelea que termines con ella en el mazo',
  camp: { after: (x) => { x.p.gold += pick(x, 5, 8) + x.growth(217); }, end: (x) => x.grow(217) } });
def(218, 'Ejército de oro', 'humano', 'rara', { cost: cf(0, 12, 0, 3), kw: ['quema'], text: 'Daño 3 por cada 20 de oro', plusText: 'Daño 3 por cada 15 de oro',
  camp: { dyn: (x) => { x.op[6] = 3 * Math.floor((x.p.gold || 0) / pick(x, 20, 15)); } } });
def(219, 'Diezmo del rey', 'humano', 'poco', { cost: c(0, 0, 6), text: 'Tu rey gana carga igual a tu oro ÷ 25', plusText: 'Tu rey gana carga igual a tu oro ÷ 18',
  camp: { after: (x) => { x.p.kingCharge = (x.p.kingCharge || 0) + Math.floor((x.p.gold || 0) / pick(x, 25, 18)); } } });

/* ---------- Enanos: el muro ---------- */
def(220, 'Muralla que avanza', 'enano', 'comun', { cost: c(8), text: 'Daño igual a la mitad de tu muro', plusText: 'Daño igual al 70 % de tu muro',
  camp: { dyn: (x) => { x.op[6] = Math.floor(x.p.wall * pick(x, 0.5, 0.7)); } } });
def(221, 'Piedra sobre piedra', 'enano', 'comun', { cost: c(4), s: s({ wall: 5 }), kw: ['guardada'], text: 'Muro +5', plusText: 'Muro +7', plus: { s: s({ wall: 7 }) } });
def(222, 'Cantería', 'enano', 'comun', { cost: c(6), kw: ['obra'], text: 'Obra: muro +3 al empezar cada turno tuyo', plusText: 'Obra: muro +4 al empezar cada turno tuyo',
  camp: { work: { tick: (x) => { x.p.wall += Math.round(pick(x, 3, 4) * x.mult); } } } });
def(223, 'Escudo de runas', 'enano', 'poco', { cost: cf(0, 0, 5, 1), text: 'Hasta tu próximo turno tu muro no baja de lo que tiene ahora', plusText: 'Hasta tu próximo turno y el siguiente tu muro no baja de lo que tiene ahora',
  camp: { after: (x) => { x.p.wallFloor = x.p.wall; x.p.wallFloorTurns = pick(x, 0, 1); } } });
def(224, 'Martillazo de piedra', 'enano', 'comun', { cost: c(0, 7), text: 'Daño 8; con tu muro en 30 o más, daño 14', plusText: 'Daño 10; con tu muro en 30 o más, daño 17',
  camp: { dyn: (x) => { x.op[6] = x.p.wall >= 30 ? pick(x, 14, 17) : pick(x, 8, 10); } } });
def(225, 'Derrumbe controlado', 'enano', 'poco', { kw: ['quema'], text: 'Tirás todo tu muro: daño igual a lo que tenía', plusText: 'Tirás todo tu muro: daño igual a lo que tenía + 20 %',
  camp: { can: (p) => p.wall > 0, dyn: (x) => { x.op[6] = Math.floor(x.p.wall * pick(x, 1, 1.2)); x.s[6] = -x.p.wall; } } });
def(226, 'Forja de la montaña', 'enano', 'poco', { cost: c(8), kw: ['obra'], text: 'Obra: con tu muro en 25 o más, ladrillos +3 al empezar cada turno tuyo', plusText: 'Obra: con tu muro en 20 o más, ladrillos +3 al empezar cada turno tuyo',
  camp: { work: { value: 4, tick: (x) => { if (x.p.wall >= pick(x, 25, 20)) x.p.brick += Math.round(3 * x.mult); } } } });
def(227, 'Baluarte', 'enano', 'rara', { cost: cf(14, 0, 0, 3), kw: ['quema'], text: 'Duplicás tu muro (hasta +40)', plusText: 'Duplicás tu muro (hasta +60)',
  camp: { dyn: (x) => { x.s[6] = Math.min(x.p.wall, pick(x, 40, 60)); } } });
def(228, 'Avalancha', 'enano', 'rara', { cost: cf(12, 0, 0, 2), text: 'Daño igual a tu muro; tu muro queda en 0', plusText: 'Daño igual a tu muro; tu muro queda a la mitad',
  camp: { can: (p) => p.wall > 0, dyn: (x) => { x.op[6] = x.p.wall; x.s[6] = -(x.plus ? Math.ceil(x.p.wall / 2) : x.p.wall); } } });
def(229, 'Piedra viva', 'enano', 'rara', { cost: c(0, 0, 6), s: s({ wall: 4 }), kw: ['crece'], text: 'Muro +4. Crece: cada pelea que termines con muro 40 o más, empezás las siguientes con muro +2 más', plusText: 'Muro +4. Crece: cada pelea que termines con muro 40 o más, empezás las siguientes con muro +3 más',
  camp: { start: (x) => { x.p.wall += pick(x, 2, 3) * x.growth(229); }, end: (x) => { if (x.p.wall >= 40) x.grow(229); } } });

/* ---------- Orcos: la sangre ---------- */
def(230, 'Furia de sangre', 'orco', 'comun', { cost: blood(5), text: 'Cuesta 5 de castillo. Este turno tus ataques hacen +4', plusText: 'Cuesta 5 de castillo. Este turno tus ataques hacen +6',
  camp: { after: (x) => { x.p.turnAtk += pick(x, 4, 6); } } });
def(231, 'Tajo salvaje', 'orco', 'comun', { cost: c(0, 6), s: s({ castle: -2 }), o: o({ dmg: 8 }), text: 'Daño 8; perdés 2 de castillo', plusText: 'Daño 11; perdés 2 de castillo', plus: { o: o({ dmg: 11 }) },
  camp: { can: (p) => p.castle > 2 } });
def(232, 'Grito de guerra', 'orco', 'comun', { cost: cf(0, 3, 0, 1), text: 'Daño 4 por cada ataque que jugaste este turno, contando este', plusText: 'Daño 5 por cada ataque que jugaste este turno, contando este',
  camp: { dyn: (x) => { x.op[6] = pick(x, 4, 5) * ((x.p.turnAtks || 0) + 1); } } });
def(233, 'Sed de batalla', 'orco', 'poco', { cost: blood(4), s: s({ w: 6 }), rapid: true, text: 'Cuesta 4 de castillo. Armas +6', plusText: 'Cuesta 4 de castillo. Armas +9', plus: { s: s({ w: 9 }) } });
def(234, 'Herido y peligroso', 'orco', 'poco', { cost: c(0, 8), text: 'Daño 6; con tu castillo por debajo de 15, daño 16', plusText: 'Daño 8; con tu castillo por debajo de 15, daño 20',
  camp: { dyn: (x) => { x.op[6] = x.p.castle < 15 ? pick(x, 16, 20) : pick(x, 6, 8); } } });
def(235, 'Tambor de huesos', 'orco', 'poco', { cost: c(0, 6), kw: ['obra'], text: 'Obra: mientras esté, tus ataques hacen +2', plusText: 'Obra: mientras esté, tus ataques hacen +3',
  camp: { work: { atk: 2, value: 7 } }, plus: { camp: { work: { atk: 3, value: 9 } } } });
def(236, 'Banquete', 'orco', 'comun', { cost: c(6), text: 'Castillo +6 y +1 por cada enemigo que venciste en la run (hasta +10)', plusText: 'Castillo +6 y +1 por cada enemigo que venciste en la run (hasta +15)',
  camp: { dyn: (x) => { x.s[7] = 6 + Math.min(pick(x, 10, 15), x.p.kills || 0); } } });
def(237, 'Berserker de sangre', 'orco', 'rara', { cost: cf(0, 10, 0, 3), kw: ['quema'], text: 'Daño 3 por cada 5 de castillo que te falten para tu vida máxima', plusText: 'Daño 3 por cada 4 de castillo que te falten para tu vida máxima',
  camp: { dyn: (x) => { x.op[6] = 3 * Math.floor(Math.max(0, (x.p.maxCastle || 30) - x.p.castle) / pick(x, 5, 4)); } } });
def(238, 'Piel de jabalí', 'orco', 'poco', { cost: c(7), s: s({ wall: 8 }), text: 'Muro +8; hasta tu próximo turno, el próximo daño a tu castillo es 0', plusText: 'Muro +12; hasta tu próximo turno, el próximo daño a tu castillo es 0',
  plus: { s: s({ wall: 12 }) }, camp: { after: (x) => { x.p.castleShield = true; } } });
def(239, 'Horda sangrienta', 'orco', 'rara', { cost: cf(0, 14, 0, 2), s: s({ castle: -6 }), o: o({ dmg: 24 }), text: 'Daño 24; perdés 6 de castillo', plusText: 'Daño 30; perdés 6 de castillo', plus: { o: o({ dmg: 30 }) },
  camp: { can: (p) => p.castle > 6 } });

/* ---------- Elfos: el ciclo ---------- */
def(240, 'Danza de hojas', 'elfo', 'comun', { cost: c(0, 0, 4), text: 'Daño 3, +3 por cada carta que cambiaste este turno', plusText: 'Daño 3, +4 por cada carta que cambiaste este turno',
  camp: { dyn: (x) => { x.op[6] = 3 + pick(x, 3, 4) * ((x.g && x.g.cycles) || 0); } } });
def(241, 'Brisa', 'elfo', 'comun', { cost: c(0, 0, 2), rapid: true, text: 'Este turno podés cambiar 2 cartas más', plusText: 'Este turno podés cambiar 3 cartas más',
  camp: { after: (x) => { x.p.cycleBonus += pick(x, 2, 3); } } });
def(242, 'Ojo del bosque', 'elfo', 'comun', { cost: c(0, 0, 3), text: 'Levantás 2 cartas', plusText: 'Levantás 3 cartas', camp: { after: (x) => x.draw(pick(x, 2, 3)) } });
def(243, 'Flecha certera', 'elfo', 'comun', { cost: c(0, 5), text: 'Daño 7; si es la 3.ª carta que jugás este turno, daño 14', plusText: 'Daño 9; si es la 3.ª carta que jugás este turno, daño 18',
  camp: { dyn: (x) => { x.op[6] = (x.p.turnPlays || 0) >= 2 ? pick(x, 14, 18) : pick(x, 7, 9); } } });
def(244, 'Bosque que responde', 'elfo', 'poco', { cost: c(0, 0, 8), kw: ['obra'], text: 'Obra: al empezar cada turno tuyo, cristales +2 y podés cambiar 1 carta más', plusText: 'Obra: al empezar cada turno tuyo, cristales +3 y podés cambiar 1 carta más',
  camp: { work: { tick: (x) => { x.p.crystal += Math.round(pick(x, 2, 3) * x.mult); x.p.cycleBonus += 1; } } } });
const memo = (p) => { for (let j = p.used.length - 1; j >= 0; j--) { const id = p.used[j]; if (!FXOK(id)) return j; } return -1; };
const FXOK = (id) => id === 245 || id === 245 + PLUS || [190, 191, 192, 193, 194, 195, 283, 283 + PLUS].includes(id);
def(245, 'Memoria antigua', 'elfo', 'poco', { cost: c(0, 0, 5), kw: ['quema'], text: 'Recuperás a tu mano la última carta de tu descarte', plusText: 'Recuperás a tu mano la última carta de tu descarte',
  plus: { kw: [] }, camp: { can: (p) => memo(p) >= 0, after: (x) => { const j = memo(x.p); if (j >= 0) { const [id] = x.p.used.splice(j, 1); x.p.hand.push(id); x.fx.push('recover:' + id); } } } });
def(246, 'Hoja que vuelve', 'elfo', 'poco', { cost: c(0, 6), o: o({ dmg: 8 }), kw: ['guardada'], text: 'Daño 8', plusText: 'Daño 11', plus: { o: o({ dmg: 11 }) } });
def(247, 'Canción del alba', 'elfo', 'rara', { cost: cf(0, 0, 10, 2), text: 'Este turno tenés 1 jugada más', plusText: 'Este turno tenés 2 jugadas más',
  plus: { kw: ['quema'] }, camp: { after: (x) => { x.g.playsLeft = (x.g.playsLeft || 1) + pick(x, 1, 2); } } });
def(248, 'Raíces', 'elfo', 'poco', { cost: c(0, 0, 6), text: 'Muro +4 por cada carta en tu mano', plusText: 'Muro +5 por cada carta en tu mano',
  camp: { dyn: (x) => { x.s[6] = pick(x, 4, 5) * x.p.hand.length; } } });
def(249, 'Tormenta de hojas', 'elfo', 'rara', { cost: cf(0, 0, 12, 3), text: 'Daño 2 por cada carta que levantaste o cambiaste en esta pelea (hasta 30)', plusText: 'Daño 2 por cada carta que levantaste o cambiaste en esta pelea (hasta 40)',
  camp: { dyn: (x) => { x.op[6] = Math.min(pick(x, 30, 40), 2 * ((x.p.cyclesBattle || 0) + (x.p.drawnBattle || 0))); } } });

/* ---------- Gnomos: las máquinas ---------- */
def(250, 'Torreta de vapor', 'gnomo', 'comun', { cost: c(7), kw: ['obra'], text: 'Obra: daño 3 al empezar cada turno tuyo', plusText: 'Obra: daño 4 al empezar cada turno tuyo',
  camp: { work: { value: 8, tick: (x) => x.hurt(Math.round((pick(x, 3, 4) + x.growth(259)) * x.mult)) } } });
def(251, 'Engranaje suelto', 'gnomo', 'comun', { cost: c(3), rapid: true, text: 'Tus Obras actúan una vez ya', plusText: 'Tus Obras actúan dos veces ya',
  camp: { after: (x) => x.runWorks(pick(x, 1, 2)) } });
def(252, 'Caldera', 'gnomo', 'comun', { cost: c(6), kw: ['obra'], text: 'Obra: armas +2 y cristales +2 al empezar cada turno tuyo', plusText: 'Obra: armas +3 y cristales +3 al empezar cada turno tuyo',
  camp: { work: { tick: (x) => { const n = Math.round(pick(x, 2, 3) * x.mult); x.p.weapon += n; x.p.crystal += n; } } } });
def(253, 'Llave maestra', 'gnomo', 'poco', { cost: cf(4, 0, 0, 1), text: 'La próxima vez que actúen tus Obras dan +50 %', plusText: 'La próxima vez que actúen tus Obras dan el doble',
  camp: { after: (x) => { x.p.workBoost = pick(x, 0.5, 1); } } });
def(254, 'Ballesta automática', 'gnomo', 'poco', { cost: c(0, 9), o: o({ dmg: 6 }), kw: ['obra'], text: 'Daño 6. Obra: daño 2 al empezar cada turno tuyo', plusText: 'Daño 9. Obra: daño 3 al empezar cada turno tuyo',
  plus: { o: o({ dmg: 9 }) }, camp: { work: { value: 6, tick: (x) => x.hurt(Math.round(pick(x, 2, 3) * x.mult)) } } });
def(255, 'Taller de urgencia', 'gnomo', 'poco', { text: 'Desarmás tu Obra más vieja: daño 3 por cada turno que estuvo (mínimo 3)', plusText: 'Desarmás tu Obra más vieja: daño 4 por cada turno que estuvo (mínimo 4)',
  camp: { can: (p) => (p.works || []).length > 0, dyn: (x) => { const w = (x.p.works || [])[0]; x.op[6] = w ? pick(x, 3, 4) * Math.max(1, w.age) : 0; }, after: (x) => { const w = x.p.works.shift(); if (w) x.fx.push('workGone:' + w.id); } } });
def(256, 'Muro mecánico', 'gnomo', 'comun', { cost: c(8), kw: ['obra'], text: 'Obra: muro +3 al empezar cada turno tuyo', plusText: 'Obra: muro +4 al empezar cada turno tuyo',
  camp: { work: { tick: (x) => { x.p.wall += Math.round(pick(x, 3, 4) * x.mult); } } } });
def(257, 'Gran Invento', 'gnomo', 'rara', { cost: cf(12, 0, 0, 3), kw: ['obra'], text: 'Obra (ocupa 2 lugares): daño 6 al empezar cada turno tuyo', plusText: 'Obra (ocupa 2 lugares): daño 8 al empezar cada turno tuyo',
  camp: { work: { slots: 2, value: 14, tick: (x) => x.hurt(Math.round(pick(x, 6, 8) * x.mult)) } } });
def(258, 'Sobrecarga', 'gnomo', 'rara', { cost: cf(0, 0, 6, 2), text: 'Tus Obras actúan 3 veces ya; después se rompen todas', plusText: 'Tus Obras actúan 3 veces ya',
  plus: { kw: ['quema'] }, camp: { can: (p) => (p.works || []).length > 0, after: (x) => { x.runWorks(3); if (!x.plus) { for (const w of x.p.works) x.fx.push('workGone:' + w.id); x.p.works = []; } } } });
def(259, 'Patente', 'gnomo', 'poco', { cost: c(0, 0, 8), kw: ['crece'], text: 'Construís una Torreta de vapor (Obra). Crece: cada Obra que construís en la run, tus Torretas hacen +1 para siempre', plusText: 'Construís una Torreta de vapor (Obra). Crece: cada Obra que construís en la run, tus Torretas hacen +2 para siempre',
  camp: { after: (x) => x.addWork(250) } });

/* ---------- Drow: el veneno ---------- */
def(260, 'Telaraña', 'drow', 'comun', { cost: c(0, 0, 4), text: 'Le metés 2 Pánicos al rival', plusText: 'Le metés 3 Pánicos al rival', camp: { after: (x) => x.give(x.o, 194, pick(x, 2, 3)) } });
def(261, 'Daga envenenada', 'drow', 'comun', { cost: c(0, 5), o: o({ dmg: 6 }), text: 'Daño 6 y le metés 1 Brecha al rival', plusText: 'Daño 9 y le metés 1 Brecha al rival', plus: { o: o({ dmg: 9 }) }, camp: { after: (x) => x.give(x.o, 193) } });
def(262, 'Banquete de sombras', 'drow', 'comun', { cost: c(0, 0, 6), text: 'Daño 4 por cada estado en la mano rival', plusText: 'Daño 5 por cada estado en la mano rival',
  camp: { dyn: (x) => { x.op[6] = pick(x, 4, 5) * x.o.hand.filter((id) => ST.has(id)).length; } } });
def(263, 'Niebla', 'drow', 'comun', { cost: c(0, 0, 3), text: 'Le metés 1 Humo al rival y levantás 1 carta', plusText: 'Le metés 1 Humo al rival y levantás 2 cartas', camp: { after: (x) => { x.give(x.o, 195); x.draw(pick(x, 1, 2)); } } });
def(264, 'Nido de arañas', 'drow', 'poco', { cost: c(0, 0, 8), kw: ['obra'], text: 'Obra: le metés 1 Pánico al rival al empezar cada turno tuyo', plusText: 'Obra: le metés 1 Pánico al rival al empezar cada turno tuyo, y 1 Brecha cada 2 turnos',
  camp: { work: { value: 6, tick: (x) => { x.give(x.o, 194); if (x.plus && x.w.age % 2 === 1) x.give(x.o, 193); } } } });
def(265, 'Susurro venenoso', 'drow', 'poco', { cost: cf(0, 0, 5, 1), text: 'Esta pelea, el rival pierde 2 de castillo por cada estado que tenga en la mano al terminar su turno', plusText: 'Esta pelea, el rival pierde 3 de castillo por cada estado que tenga en la mano al terminar su turno',
  camp: { after: (x) => { x.p.poison = Math.max(x.p.poison || 0, pick(x, 2, 3)); } } });
def(266, 'Corte limpio', 'drow', 'comun', { cost: c(0, 6), text: 'Daño 7; si el rival tiene un estado en la mano, daño 12', plusText: 'Daño 9; si el rival tiene un estado en la mano, daño 15',
  camp: { dyn: (x) => { x.op[6] = x.o.hand.some((id) => ST.has(id)) ? pick(x, 12, 15) : pick(x, 7, 9); } } });
def(267, 'Maldición de Vaelith', 'drow', 'rara', { cost: cf(0, 0, 10, 3), kw: ['quema'], text: 'Le metés una Plaga de ratas en el mazo al rival (para toda la pelea)', plusText: 'Le metés 2 Plagas de ratas en el mazo al rival (para toda la pelea)',
  camp: { after: (x) => x.giveDeck(x.o, 190, pick(x, 1, 2)) } });
def(268, 'Robo de sombras', 'drow', 'poco', { cost: c(0, 0, 6), text: 'Le robás 4 de cada recurso por cada estado en su mano (hasta 12 de cada uno)', plusText: 'Le robás 4 de cada recurso por cada estado en su mano (hasta 18 de cada uno)',
  camp: { after: (x) => { const n = Math.min(pick(x, 12, 18), 4 * x.o.hand.filter((id) => ST.has(id)).length); for (const k of ['brick', 'weapon', 'crystal']) { const t = Math.min(n, x.o[k]); x.o[k] -= t; x.p[k] += t; } } } });
def(269, 'Reina de las arañas', 'drow', 'rara', { cost: cf(0, 0, 12, 2), text: 'Daño 3 por cada estado que le metiste al rival en esta pelea', plusText: 'Daño 4 por cada estado que le metiste al rival en esta pelea',
  camp: { dyn: (x) => { x.op[6] = pick(x, 3, 4) * (x.p.statesGiven || 0); } } });

/* ---------- Neutrales de campaña ---------- */
def(270, 'Veterano', null, 'comun', { cost: c(0, 6), kw: ['crece'], text: 'Daño 8. Crece: +1 de daño para siempre cada vez que deja el muro rival en 0', plusText: 'Daño 10. Crece: +1 de daño para siempre cada vez que deja el muro rival en 0',
  camp: { dyn: (x) => { x.op[6] = pick(x, 8, 10) + (x.growth ? x.growth(270) : (x.p.grow?.[270] || 0) + (x.p.grown?.[270] || 0)); x.p._vetW = x.o.wall; }, after: (x) => { if (x.p._vetW > 0 && x.o.wall === 0) x.grow(270); } } });
def(271, 'Tesoro creciente', null, 'poco', { cost: c(4), kw: ['crece'], text: '+5 de oro. Crece: +1 de oro por cada pelea que termines con ella en el mazo', plusText: '+8 de oro. Crece: +1 de oro por cada pelea que termines con ella en el mazo',
  camp: { after: (x) => { x.p.gold += pick(x, 5, 8) + x.growth(271); }, end: (x) => x.grow(271) } });
def(272, 'Golpe de inicio', null, 'comun', { cost: c(0, 3), o: o({ dmg: 5 }), kw: ['mano'], text: 'Daño 5', plusText: 'Daño 7', plus: { o: o({ dmg: 7 }) } });
def(273, 'Muro de emergencia', null, 'comun', { cost: c(5), s: s({ wall: 8 }), kw: ['guardada'], text: 'Muro +8', plusText: 'Muro +11', plus: { s: s({ wall: 11 }) } });
def(274, 'Plan de batalla', null, 'comun', { cost: c(0, 0, 2), text: 'Levantás 1 carta; tu próxima carta de esta pelea cuesta 3 menos', plusText: 'Levantás 1 carta; tu próxima carta de esta pelea cuesta 5 menos',
  camp: { after: (x) => { x.draw(1); x.p.nextLess = pick(x, 3, 5); } } });
const worst = (p) => { let bi = -1, bv = -1; p.hand.forEach((id, i) => { const v = [190, 191, 192, 193, 194, 195, 283, 283 + PLUS].includes(id) ? 1e6 : CARDS_COST(id); if (v > bv) { bv = v; bi = i; } }); return bi; };
let CARDS_COST = () => 0; export const setCostFn = (f) => { CARDS_COST = f; };
def(275, 'Sacrificio', null, 'poco', { s: s({ b: 6, w: 6, cr: 6 }), kw: ['quema'], text: 'Sacás del juego (esta pelea) la peor carta de tu mano —una maldición o un estado si hay—: ladrillos, armas y cristales +6', plusText: 'Sacás del juego (esta pelea) la peor carta de tu mano —una maldición o un estado si hay—: ladrillos, armas y cristales +9',
  plus: { s: s({ b: 9, w: 9, cr: 9 }) }, camp: { after: (x) => { const i = worst(x.p); if (i >= 0) { const [id] = x.p.hand.splice(i, 1); x.p.burned.push(id); x.fx.push('exhaust:' + id); } } } });
def(276, 'Doble filo', null, 'poco', { cost: c(0, 8), o: o({ dmg: 14 }), text: 'Daño 14; te metés una Brecha', plusText: 'Daño 18; te metés una Brecha', plus: { o: o({ dmg: 18 }) }, camp: { after: (x) => x.give(x.p, 193) } });
def(277, 'Reconstrucción mayor', null, 'comun', { cost: c(10), s: s({ castle: 12 }), text: 'Castillo +12', plusText: 'Castillo +16', plus: { s: s({ castle: 16 }) } });
def(278, 'Asedio total', null, 'rara', { cost: c(0, 15), o: o({ dmg: 25 }), kw: ['quema'], text: 'Daño 25', plusText: 'Daño 32', plus: { o: o({ dmg: 32 }) } });
def(279, 'Campamento', null, 'poco', { cost: c(6), kw: ['obra'], text: 'Obra: castillo +2 al empezar cada turno tuyo', plusText: 'Obra: castillo +3 al empezar cada turno tuyo',
  camp: { work: { value: 7, tick: (x) => { x.p.castle += Math.round(pick(x, 2, 3) * x.mult); } } } });
def(280, 'Espía de la corte', null, 'comun', { cost: c(0, 0, 3), text: 'Ves la trampa del enemigo y su próxima jugada aunque tengas Humo', plusText: 'Ves la trampa del enemigo y sus próximas 2 jugadas aunque tengas Humo',
  camp: { after: (x) => { if (x.o.trap) { x.o.trapSeen = true; x.fx.push('trapReveal:' + x.o.trap); } x.p.seeIntent = pick(x, 1, 2); } } });
def(281, 'Contraataque', null, 'poco', { cost: c(0, 5), text: 'Daño igual al daño que recibiste en el turno anterior del enemigo', plusText: 'Daño igual a 1,5 veces el daño que recibiste en el turno anterior del enemigo',
  camp: { dyn: (x) => { x.op[6] = Math.floor((x.p.lastDamage || 0) * pick(x, 1, 1.5)); } } });
def(282, 'Mapa robado', null, 'rara', { cost: c(0, 0, 4), kw: ['quema'], text: 'Fuera de pelea: elegís el próximo nodo aunque no esté conectado (una vez por run)', plusText: 'Fuera de pelea: elegís el próximo nodo aunque no esté conectado (dos veces por run)',
  camp: { outside: true, uses: 1 }, plus: { camp: { outside: true, uses: 2 } } });
def(283, 'Arca vacía', null, 'comun', { curse: true, text: 'Maldición: no se juega ni se descarta. Al terminar la pelea, +15 de oro', plusText: 'Maldición: no se juega ni se descarta. Al terminar la pelea, +25 de oro',
  camp: { end: (x) => { x.p.gold += pick(x, 15, 25); } } });
def(284, 'Juramento', null, 'rara', { s: s({ castle: -10 }), kw: ['mano', 'quema'], text: 'Este turno tus cartas cuestan 0, pero perdés 10 de castillo', plusText: 'Este turno tus cartas cuestan 0, pero perdés 6 de castillo',
  plus: { s: s({ castle: -6 }) }, camp: { can: (p) => p.castle > 10, after: (x) => { x.p.freeTurn = true; } } });
export const CAMP_IDS = Object.keys(CAMP_INFO).map(Number);
export const hasPlus = (id) => !!CAMP_INFO[id];
export const plusOf = (id) => (CAMP_INFO[id] ? id + PLUS : id);
export const baseOf = (id) => (id > PLUS ? id - PLUS : id);
export const isPlus = (id) => id > PLUS;
