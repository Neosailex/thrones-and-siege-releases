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
  // Estados nuevos (S03 01/11, enemigos.md): Red (sin ataques un turno) y Herida (basura hasta fin de pelea)
  202: ['Red', 'Estado: mientras esté en tu mano no podés jugar ataques; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  203: ['Herida', 'Maldición de pelea: no se juega ni se descarta; ocupa un lugar en tu mano y se va al terminar la pelea', Z, Z, Z, { k: 'curse', battle: true }],
  207: ['Escombros', 'Maldición de pelea: no se juega ni se descarta; ocupa un lugar en tu mano y se va al terminar la pelea', Z, Z, Z, { k: 'curse', battle: true }], // (S03 11/11) el derrumbe del Desenterrador
  205: ['Vulnerable', 'Estado: mientras esté en tu mano recibís 50 % más de daño; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  206: ['Confusión', 'Estado: mientras esté en tu mano tus cartas cuestan de 2 menos a 2 más, al azar; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  204: ['Quemadura', 'Estado: si te queda en la mano al terminar tu turno, perdés 3 de castillo; desaparece al terminar tu turno', Z, Z, Z, { k: 'state' }],
  // Acciones de bicho (300-316): costo 0, las juegan los enemigos con patrón (bestias, construcciones, campamentos). intent = lo que muestra la intención
  300: ['Puñalada', 'Daño 5', Z, Z, o({ dmg: 5 }), { k: 'bug' }],
  301: ['Bomba de humo', 'Te mete Humo (no ves su intención): está por huir', Z, Z, Z, { k: 'bug', give: 195, intent: 'Prepara la huida (bomba de humo)', kind: 'effect' }],
  302: ['Rezo', 'No ataca: desde ahora sus ataques pegan +1 cada turno', Z, Z, Z, { k: 'bug', intent: 'Reza (desde ahora pega +1 por turno)', kind: 'effect' }],
  303: ['Daga ritual', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  304: ['Susurro', 'Te mete Miedo (tus ataques hacen 1 menos)', Z, Z, Z, { k: 'bug', give: 192, intent: 'Susurra: te mete Miedo', kind: 'curse' }],
  305: ['Mordisco', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  306: ['Chillido', 'Te mete Miedo', Z, Z, Z, { k: 'bug', give: 192, intent: 'Chilla: te mete Miedo', kind: 'curse' }],
  307: ['Látigo', 'Daño 6 y te mete Miedo', Z, Z, o({ dmg: 6 }), { k: 'bug', give: 192 }],
  308: ['Red de los negreros', 'Te mete Red: tu próximo turno no podés jugar ataques', Z, Z, Z, { k: 'bug', give: 202, intent: 'Tira la red: tu próximo turno sin ataques', kind: 'curse' }],
  309: ['Mordida', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  310: ['Cava', 'Su próximo golpe saltea tu muro', Z, Z, Z, { k: 'bug', then: 311, intent: 'Cava: su próximo golpe va directo a tu castillo', kind: 'effect' }],
  311: ['Emerge', '7 directo al castillo', Z, Z, o({ direct: 7 }), { k: 'bug' }],
  312: ['Se entierra', 'Muro +8 hasta su próximo turno', Z, Z, Z, { k: 'bug', tempWall: 8, intent: 'Se entierra: muro +8 hasta su turno', kind: 'wall' }],
  313: ['Rugido', 'Sus ataques +3 (toda la pelea)', Z, Z, Z, { k: 'bug', atkUp: 3, intent: 'Ruge: sus ataques +3', kind: 'effect' }],
  314: ['Garrotazo', 'Daño 12', Z, Z, o({ dmg: 12 }), { k: 'bug' }],
  315: ['Aplastar', 'Daño 7 y te mete Brecha', Z, Z, o({ dmg: 7 }), { k: 'bug', give: 193 }],
  // Reino enano (S03 04/11): 317-331
  317: ['Pico', 'Daño 5', Z, Z, o({ dmg: 5 }), { k: 'bug' }],
  318: ['Mordisco de murciélago', 'Daño 3', Z, Z, o({ dmg: 3 }), { k: 'bug' }],
  319: ['Junta piedras', 'No ataca: el próximo turno golpea fuerte', Z, Z, Z, { k: 'bug', intent: 'Junta piedras: el próximo turno golpea fuerte', kind: 'effect' }],
  320: ['Golpe de piedra', 'Daño 14', Z, Z, o({ dmg: 14 }), { k: 'bug' }],
  321: ['Ronquido', 'Duerme: muro +6 (se despierta si le pegás)', Z, Z, Z, { k: 'bug', wallUp: 6, intent: 'Duerme: muro +6 (si le pegás, se despierta)', kind: 'wall' }],
  322: ['Zarpazo', 'Daño 8 y rival −1 mago', Z, Z, o({ dmg: 8, ma: 1 }), { k: 'bug' }],
  323: ['Rayo de la torre', 'Daño 10', Z, Z, o({ dmg: 10 }), { k: 'bug' }],
  324: ['Humo de la torre', 'Te mete Humo (no ves su intención)', Z, Z, Z, { k: 'bug', give: 195, intent: 'Te tira humo: no vas a ver su intención', kind: 'effect' }],
  325: ['Rayo rúnico', 'Daño 10', Z, Z, o({ dmg: 10 }), { k: 'bug' }],
  326: ['Pulso rúnico', 'Sus ataques +2 (toda la pelea)', Z, Z, Z, { k: 'bug', atkUp: 2, intent: 'Carga las runas: sus ataques +2', kind: 'effect' }],
  327: ['Golpe de hierro', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  328: ['Modo muralla', 'Se cierra: recibe la mitad de daño y tiene espinas (tus ataques te lastiman el muro)', Z, Z, Z, { k: 'bug', intent: 'Modo muralla: recibe la mitad y tiene espinas', kind: 'wall' }],
  329: ['Martillo de la forja', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  330: ['Brasas', 'Te mete Quemadura (si te queda en la mano, −3 castillo)', Z, Z, Z, { k: 'bug', give: 204, intent: 'Escupe brasas: te mete Quemadura', kind: 'curse' }],
  331: ['Recarga', 'No ataca: junta vapor para el próximo golpe', Z, Z, Z, { k: 'bug', intent: 'Recarga vapor: no ataca este turno', kind: 'effect' }],
  // Estepas de Gorrak (S03 04/11): 332-344
  332: ['Mordisco de huargo', 'Daño 3, dos veces', Z, Z, o({ dmg: 3 }), { k: 'bug', hits: 2 }],
  334: ['Garrote de duende', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  335: ['Carga del duende', 'No ataca: el próximo turno pega 15', Z, Z, Z, { k: 'bug', then: 336, intent: 'Carga: el próximo turno pega fuerte', kind: 'effect' }],
  336: ['Golpazo del duende', 'Daño 15', Z, Z, o({ dmg: 15 }), { k: 'bug' }],
  337: ['Rayo de sangre', 'Daño 5', Z, Z, o({ dmg: 5 }), { k: 'bug' }],
  338: ['Hacha orca', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  339: ['Colmillo', 'Daño 7', Z, Z, o({ dmg: 7 }), { k: 'bug' }],
  340: ['Embestida', '7 directo al castillo', Z, Z, o({ direct: 7 }), { k: 'bug' }],
  341: ['Látigo de la estepa', 'Daño 8 y te mete Miedo (si no tenés ya 2)', Z, Z, o({ dmg: 8 }), { k: 'bug', give: 192, giveMax: 2 }],
  343: ['Golpe del guerrero', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  // Bosque de Aelwyn (S03 04/11): 346-357
  346: ['Picotazo', 'Daño 3', Z, Z, o({ dmg: 3 }), { k: 'bug' }],
  347: ['Garras', 'Daño 2 y rival −1 soldado', Z, Z, o({ dmg: 2, so: 1 }), { k: 'bug' }],
  348: ['Esporas', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  349: ['Nube de esporas', 'Te mete Vulnerable (recibís 50 % más un turno)', Z, Z, Z, { k: 'bug', give: 205, intent: 'Larga esporas: te mete Vulnerable', kind: 'curse' }],
  350: ['Flechas de los exploradores', 'Daño 3, dos veces', Z, Z, o({ dmg: 3 }), { k: 'bug', hits: 2 }],
  351: ['Latigazo de espinas', 'Daño 5', Z, Z, o({ dmg: 5 }), { k: 'bug' }],
  352: ['Mordida de la planta', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  353: ['Raíces', 'Te mete Red (tu próximo turno sin ataques)', Z, Z, Z, { k: 'bug', give: 202, intent: 'Raíces: tu próximo turno sin ataques', kind: 'curse' }],
  354: ['Golpe de rama', 'Daño 10', Z, Z, o({ dmg: 10 }), { k: 'bug' }],
  355: ['Ilusión', 'Te mete Confusión (tus cartas cuestan al azar)', Z, Z, Z, { k: 'bug', give: 206, intent: 'Ilusión: tus cartas van a costar al azar', kind: 'curse' }],
  356: ['Se sumerge', 'Intangible: hasta su próximo turno cada golpe le hace 1', Z, Z, Z, { k: 'bug', intent: 'Se sumerge: cada golpe le hace 1', kind: 'effect' }],
  357: ['Mordida doble', 'Daño 7, dos veces', Z, Z, o({ dmg: 7 }), { k: 'bug', hits: 2 }],
  358: ['Lluvia corrompida', 'Daño 3, una vez más cada turno', Z, Z, o({ dmg: 3 }), { k: 'bug', pages: true }],
  359: ['Puñal del ilusionista', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  // Talleres de Fizzwick (S03 04/11): 360-371
  360: ['Tic', 'Cuenta regresiva: explota en 2 turnos', Z, Z, Z, { k: 'bug', intent: 'Tic… (explota en 2 turnos)', kind: 'effect' }],
  361: ['Tac', 'Cuenta regresiva: explota el próximo turno', Z, Z, Z, { k: 'bug', intent: 'Tac… ¡explota el próximo turno!', kind: 'effect' }],
  362: ['¡Bum!', 'Daño 25 y el polvorín desaparece', Z, Z, o({ dmg: 25 }), { k: 'bug', selfDestruct: true }],
  363: ['Disparo de vapor', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  364: ['Mordisco de engranaje', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  365: ['Chirrido', 'Te mete Miedo', Z, Z, Z, { k: 'bug', give: 192, intent: 'Chirría: te mete Miedo', kind: 'curse' }],
  366: ['Embiste acorazado', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  367: ['Roca de catapulta', 'Daño 7', Z, Z, o({ dmg: 7 }), { k: 'bug' }],
  368: ['Puño de latón', 'Daño 13 y te mete Pánico', Z, Z, o({ dmg: 13 }), { k: 'bug', give: 194 }],
  369: ['Carga el rayo', 'No ataca: el próximo turno lanza un rayo enorme', Z, Z, Z, { k: 'bug', then: 370, intent: 'Carga el rayo: el próximo turno, rayo enorme', kind: 'effect' }],
  370: ['Rayo de estasis', 'Daño 25', Z, Z, o({ dmg: 25 }), { k: 'bug', then: 371 }],
  371: ['Aturdido', 'No hace nada este turno', Z, Z, Z, { k: 'bug', intent: 'Aturdido: no hace nada', kind: 'other' }],
  372: ['Engranaje del tiempo', 'Daño 7', Z, Z, o({ dmg: 7 }), { k: 'bug' }],
  // Cavernas de Vaelith (S03 04/11): 373-386
  373: ['Mordisco venenoso', 'Daño 4', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  374: ['Telaraña', 'Te mete Red (tu próximo turno sin ataques)', Z, Z, Z, { k: 'bug', give: 202, intent: 'Teje: tu próximo turno sin ataques', kind: 'curse' }],
  375: ['Garra de sombra', 'Daño 3', Z, Z, o({ dmg: 3 }), { k: 'bug' }],
  377: ['Hilo maldito', 'Daño 4 y te mete una Plaga de ratas que se queda en tu mazo', Z, Z, o({ dmg: 4 }), { k: 'bug' }],
  378: ['Abrazo de telaraña', 'Daño 10', Z, Z, o({ dmg: 10 }), { k: 'bug' }],
  379: ['Capullo', 'Muro +8', Z, Z, Z, { k: 'bug', wallUp: 8, intent: 'Se envuelve: muro +8', kind: 'wall' }],
  380: ['Se esfuma', 'Intangible hasta su próximo turno (cada golpe le hace 1) y te mete Quemadura', Z, Z, Z, { k: 'bug', give: 204, intent: 'Se esfuma: cada golpe le hace 1 y te mete Quemadura', kind: 'effect' }],
  381: ['Guadaña', 'Daño 6, dos veces', Z, Z, o({ dmg: 6 }), { k: 'bug', hits: 2 }],
  382: ['Invoca dagas', 'Invoca dagas (secuaz): si siguen vivas a los 3 turnos, explotan', Z, Z, Z, { k: 'bug', intent: 'Invoca dagas: explotan en 3 turnos si no las rompés', kind: 'effect' }],
  383: ['Mordida de reptil', 'Daño 6', Z, Z, o({ dmg: 6 }), { k: 'bug' }],
  384: ['Maleficio', 'Desde ahora cada carta tuya que no es ataque te mete un Humo en el mazo', Z, Z, Z, { k: 'bug', intent: 'Maleficio: tus cartas que no atacan te ensucian el mazo', kind: 'curse' }],
  385: ['Tajo de la Elegida', 'Daño 5, dos veces', Z, Z, o({ dmg: 5 }), { k: 'bug', hits: 2 }],
  386: ['Drenar', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  // La Grieta (S03 04/11): 387-399
  387: ['Ácido', 'Daño 5 y lo mismo otra vez a tu muro', Z, Z, o({ dmg: 5 }), { k: 'bug', acid: true }],
  388: ['Escupe basura', 'Daño 3 y te mete Brecha', Z, Z, o({ dmg: 3 }), { k: 'bug', give: 193 }],
  389: ['Látigo retorcido', 'Daño 9', Z, Z, o({ dmg: 9 }), { k: 'bug' }],
  390: ['Retorcer', 'Daño 3 y te mete una Deuda que se queda en tu mazo', Z, Z, o({ dmg: 3 }), { k: 'bug' }],
  391: ['Lamento', 'Daño 12', Z, Z, o({ dmg: 12 }), { k: 'bug' }],
  392: ['Mirada de piedra', 'Cuenta regresiva: prepara un golpe enorme', Z, Z, Z, { k: 'bug', intent: 'Te mira… prepara un golpe enorme', kind: 'effect' }],
  393: ['Golpe de la cabeza', 'Daño 18; cada vez pega 6 más', Z, Z, o({ dmg: 18 }), { k: 'bug', atkUp: 6 }],
  394: ['Garra del demonio', 'Daño 10', Z, Z, o({ dmg: 10 }), { k: 'bug' }],
  395: ['Llamarada', 'Daño 6, dos veces, y te mete Quemadura', Z, Z, o({ dmg: 6 }), { k: 'bug', hits: 2, give: 204 }],
  396: ['Ola de sombra', 'Daño 14', Z, Z, o({ dmg: 14 }), { k: 'bug' }],
  316: ['Página', 'Daño 3, una vez más por cada turno que pasa (1, 2, 3… golpes)', Z, Z, o({ dmg: 3 }), { k: 'bug', pages: true }],
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

/* ---------- Enano de campaña: RUNAS (S03 08/11, docs/campaña/razas.md §1-2). Reemplazan a las 10 enanas viejas (220-229) ----------
   Grabar pone una runa en la primera ranura libre (con las 3 llenas se rompe sola la más vieja); actúan al empezar tu turno:
   Piedra muro +3 · Fuego daño 2 · Oro +1 del recurso más bajo · Tormenta: cuando te pegan devuelve 3. Romper = su efecto x3. */
const nRunes = (x) => (x.p.runes || []).length;
def(400, 'Grabar piedra', 'enano', 'comun', { cost: c(2), text: 'Grabá una runa de Piedra', plusText: 'Grabá una runa de Piedra; muro +2',
  camp: { after: (x) => { x.rune('piedra'); if (x.plus) x.p.wall += 2; } } });
def(401, 'Chispa rúnica', 'enano', 'comun', { cost: c(0, 2), text: 'Grabá una runa de Fuego', plusText: 'Grabá una runa de Fuego; daño 2', plus: { o: o({ dmg: 2 }) },
  camp: { after: (x) => x.rune('fuego') } });
def(402, 'Martillazo', 'enano', 'comun', { cost: c(0, 3), o: o({ dmg: 5 }), text: 'Daño 5; con 3 runas o más, daño 8', plusText: 'Daño 7; con 3 runas o más, daño 11', plus: { o: o({ dmg: 7 }) },
  camp: { dyn: (x) => { if ((x.p.runes || []).length >= 3) x.op[6] += x.plus ? 4 : 3; } } });
def(403, 'Grabar oro', 'enano', 'comun', { cost: c(0, 0, 3), text: 'Grabá una runa de Oro', plusText: 'Grabá una runa de Oro', plus: { cost: c(0, 0, 2) },
  camp: { after: (x) => x.rune('oro') } });
def(404, 'Pararrayos', 'enano', 'comun', { cost: c(0, 0, 3), text: 'Grabá una runa de Tormenta', plusText: 'Grabá una runa de Tormenta', plus: { cost: c(0, 0, 2) },
  camp: { after: (x) => x.rune('tormenta') } });
def(405, 'Muro de runas', 'enano', 'comun', { cost: c(4), s: s({ wall: 5 }), text: 'Muro 5, +1 por cada runa', plusText: 'Muro 7, +2 por cada runa', plus: { s: s({ wall: 7 }) },
  camp: { dyn: (x) => { x.s[6] += (x.p.runes || []).length * (x.plus ? 2 : 1); } } });
def(406, 'Romper', 'enano', 'comun', { cost: c(0, 0, 1), text: 'Rompé tu runa más vieja (su efecto x3)', plusText: 'Rompé tu runa más vieja (su efecto x3)', plus: { cost: free },
  camp: { can: (p) => !!(p.runes || []).length && !p.noBreak, after: (x) => x.breakOld() } });
def(407, 'Picar la veta', 'enano', 'comun', { cost: c(2), text: '+4 de tu recurso más bajo; si tenés una ranura libre, grabá una runa de Oro', plusText: '+6 de tu recurso más bajo; si tenés una ranura libre, grabá una runa de Oro',
  camp: { after: (x) => { const k = ['brick', 'weapon', 'crystal'].sort((a, b) => x.p[a] - x.p[b])[0]; x.p[k] += x.plus ? 6 : 4; if (x.runeFree()) x.rune('oro'); } } });
def(408, 'Eco rúnico', 'enano', 'poco', { cost: c(0, 0, 3), text: 'Tus runas actúan otra vez ahora', plusText: 'Tus runas actúan otra vez ahora', plus: { cost: c(0, 0, 2) },
  camp: { can: (p) => !!(p.runes || []).length, after: (x) => x.echo() } });
def(409, 'Cincelado', 'enano', 'poco', { cost: c(2), text: 'Grabá 2 runas iguales a la última que tengas (si no tenés, Piedra)', plusText: 'Grabá 2 runas iguales a la última que tengas (si no tenés, Piedra)', plus: { cost: c(1) },
  camp: { after: (x) => x.rune((x.p.runes || []).slice(-1)[0] || 'piedra', 2) } });
def(410, 'Yunque ancestral', 'enano', 'poco', { cost: c(5), kw: ['obra'], text: 'Obra: al empezar cada turno tuyo, grabá una runa de Piedra', plusText: 'Obra: al empezar cada turno tuyo, grabá una runa de Piedra', plus: { cost: c(4) },
  camp: { work: { value: 7, tick: (x) => x.rune('piedra') } } });
def(411, 'Derrumbe rúnico', 'enano', 'poco', { cost: c(0, 4), text: 'Rompé todas tus runas de Piedra: daño 4 por cada una', plusText: 'Rompé todas tus runas de Piedra: daño 6 por cada una',
  camp: { can: (p) => (p.runes || []).includes('piedra') && !p.noBreak, after: (x) => { const n = x.p.runes.filter((t) => t === 'piedra').length; x.p.runes = x.p.runes.filter((t) => t !== 'piedra'); for (let i = 0; i < n; i++) x.fx.push('rune:romper:piedra'); x.hurt(n * (x.plus ? 6 : 4), 0, x.o, 'runa:piedra'); } } });
def(412, 'Puño de basalto', 'enano', 'poco', { cost: c(0, 5), o: o({ dmg: 8 }), text: 'Daño 8; si tenés runas, rompé la más vieja y daño +6', plusText: 'Daño 10; si tenés runas, rompé la más vieja y daño +8', plus: { o: o({ dmg: 10 }) },
  camp: { dyn: (x) => { if ((x.p.runes || []).length && !x.p.noBreak) x.op[6] += x.plus ? 8 : 6; }, after: (x) => { if (x.runes()) x.breakOld(); } } });
def(413, 'Runa maestra', 'enano', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, tus runas actúan 2 veces al empezar tu turno', plusText: 'Lo que queda de la pelea, tus runas actúan 2 veces al empezar tu turno', plus: { cost: c(0, 0, 4) },
  camp: { after: (x) => { x.p.runeTimes = Math.max(2, x.p.runeTimes || 1); x.fx.push('rune:maestra'); } } });
def(414, 'Ley de la montaña', 'enano', 'rara', { cost: c(0, 0, 6), text: 'Rompé todas tus runas (x3 cada una) y volvé a grabar las mismas', plusText: 'Rompé todas tus runas (x3 cada una) y volvé a grabar las mismas', plus: { cost: c(0, 0, 5) },
  camp: { can: (p) => !!(p.runes || []).length && !p.noBreak, after: (x) => { const old = x.p.runes.slice(); x.breakAll(); x.p.runes = []; for (const t of old) x.rune(t); } } });
def(415, 'Forja viva', 'enano', 'rara', { cost: c(4), kw: ['crece'], text: 'Grabá una runa de Piedra. Crece: cada pelea que termines con ella en el mazo, graba una runa más (hasta 3)', plusText: 'Grabá una runa de Piedra y una de Fuego. Crece: cada pelea que termines con ella en el mazo, graba una runa más (hasta 3)',
  camp: { after: (x) => { const n = Math.min(3, 1 + x.growth(415)); for (let i = 0; i < n; i++) x.rune('piedra'); if (x.plus) x.rune('fuego'); }, end: (x) => x.grow(415) } });
def(416, 'Escudo de clan', 'enano', 'comun', { cost: c(3), s: s({ wall: 6 }), text: 'Muro +6', plusText: 'Muro +9', plus: { s: s({ wall: 9 }) } });
def(417, 'Barba de hierro', 'enano', 'comun', { cost: c(2), s: s({ wall: 3 }), kw: ['guardada'], text: 'Muro +3; si este turno ya subiste 10 de muro o más, grabá una runa de Piedra', plusText: 'Muro +5; si este turno ya subiste 10 de muro o más, grabá una runa de Piedra', plus: { s: s({ wall: 5 }) },
  camp: { after: (x) => { if (x.p.wall - (x.p.wallT0 ?? x.p.wall) >= 10) x.rune('piedra'); } } });

/* ---------- Orco de campaña: FURIA y FRENESÍ (S03 08/11, docs/campaña/razas.md §1-2). Reemplazan a las 10 orcas viejas (230-239) ----------
   Furia 0-10: +1 por golpe que das y por golpe que recibís; a 10, Frenesí 2 turnos (ataques x2, recibís +50 %). Sangre = se paga con castillo. */
const fury = (x) => x.p.fury || 0, inFrenzy = (x) => (x.p.frenzy || 0) > 0;
def(420, 'Tajo sangriento', 'orco', 'comun', { cost: blood(2), o: o({ dmg: 6 }), text: 'Cuesta 2 de vida. Daño 6', plusText: 'Cuesta 2 de vida. Daño 8', plus: { o: o({ dmg: 8 }) } });
def(421, 'Rugido', 'orco', 'comun', { cost: c(0, 1), text: 'Furia +3', plusText: 'Furia +4', camp: { after: (x) => x.fury(x.plus ? 4 : 3) } });
def(422, 'Embestida', 'orco', 'comun', { cost: c(0, 3), o: o({ dmg: 4 }), text: 'Daño 4, dos veces', plusText: 'Daño 5, dos veces', plus: { o: o({ dmg: 5 }) },
  camp: { after: (x) => x.hit(x.plus ? 5 : 4) } });
def(423, 'Hachazo', 'orco', 'comun', { cost: c(0, 4), o: o({ dmg: 9 }), text: 'Daño 9', plusText: 'Daño 12', plus: { o: o({ dmg: 12 }) } });
def(424, 'Sed de sangre', 'orco', 'comun', { cost: blood(3), o: o({ dmg: 5 }), text: 'Cuesta 3 de vida. Daño 5; en Frenesí curás 3', plusText: 'Cuesta 3 de vida. Daño 7; en Frenesí curás 5', plus: { o: o({ dmg: 7 }) },
  camp: { after: (x) => { if (inFrenzy(x) && !x.p.noHeal) x.p.castle += x.plus ? 5 : 3; } } });
def(425, 'Grito de guerra', 'orco', 'comun', { cost: c(0, 2), s: s({ w: 3 }), text: 'Furia +2, armas +3', plusText: 'Furia +3, armas +3', camp: { after: (x) => x.fury(x.plus ? 3 : 2) } });
def(426, 'Calma de guerra', 'orco', 'comun', { cost: c(0, 0, 2), text: 'Furia −5: muro igual a la Furia que bajaste x2 (sale del Frenesí)', plusText: 'Furia −5: muro igual a la Furia que bajaste x3 (sale del Frenesí)',
  camp: { can: (p) => (p.fury || 0) > 0, after: (x) => { const t = x.fury(-5); x.p.wall += (t || 0) * (x.plus ? 3 : 2); } } });
def(427, 'Pellejo duro', 'orco', 'comun', { cost: c(2), s: s({ wall: 5 }), text: 'Muro +5; el próximo golpe que te den te suma 2 de Furia más', plusText: 'Muro +7; el próximo golpe que te den te suma 2 de Furia más', plus: { s: s({ wall: 7 }) },
  camp: { after: (x) => { x.p.hideFury = 2; } } });
def(428, 'Matanza', 'orco', 'poco', { cost: blood(5), o: o({ dmg: 12 }), text: 'Cuesta 5 de vida. Daño 12', plusText: 'Cuesta 5 de vida. Daño 15', plus: { o: o({ dmg: 15 }) } });
def(429, 'Despertar la bestia', 'orco', 'poco', { cost: c(0, 4), text: 'Entrás en Frenesí ya', plusText: 'Entrás en Frenesí ya', plus: { cost: c(0, 3) },
  camp: { can: (p) => !(p.frenzy > 0), after: (x) => x.frenzyNow() } });
def(430, 'Tótem de sangre', 'orco', 'poco', { cost: c(0, 5), kw: ['obra'], text: 'Obra: Furia +1 al empezar cada turno tuyo', plusText: 'Obra: Furia +1 al empezar cada turno tuyo', plus: { cost: c(0, 4) },
  camp: { work: { value: 6, tick: (x) => x.fury(Math.round(x.mult)) } } });
def(431, 'Ritual de colmillos', 'orco', 'poco', { cost: blood(6), kw: ['quema'], text: 'Cuesta 6 de vida. Lo que queda de la pelea, tus ataques +2', plusText: 'Cuesta 6 de vida. Lo que queda de la pelea, tus ataques +3',
  camp: { after: (x) => { x.p.atkPlus = (x.p.atkPlus || 0) + (x.plus ? 3 : 2); } } });
def(432, 'Venganza orca', 'orco', 'poco', { cost: c(0, 3), text: 'Daño igual a la vida que perdiste desde tu turno anterior x2 (máx. 24)', plusText: 'Daño igual a la vida que perdiste desde tu turno anterior x2 (máx. 30)', plus: { cost: c(0, 2) },
  camp: { dyn: (x) => { x.op[6] = Math.min(x.plus ? 30 : 24, 2 * Math.max(0, (x.p.castleRef ?? x.p.castle) - x.p.castle)); } } });
def(433, 'Frenesí eterno', 'orco', 'rara', { cost: c(0, 6), kw: ['quema'], text: 'Lo que queda de la pelea, el Frenesí dura 1 turno más', plusText: 'Lo que queda de la pelea, el Frenesí dura 1 turno más', plus: { cost: c(0, 5) },
  camp: { after: (x) => { x.p.frenzyBonus = (x.p.frenzyBonus || 0) + 1; if (inFrenzy(x)) x.p.frenzy++; } } });
def(434, 'Masacre', 'orco', 'rara', { cost: blood(8), o: o({ dmg: 6 }), text: 'Cuesta 8 de vida. Daño 6, tres veces', plusText: 'Cuesta 8 de vida. Daño 8, tres veces', plus: { o: o({ dmg: 8 }) },
  camp: { after: (x) => { x.hit(x.plus ? 8 : 6); x.hit(x.plus ? 8 : 6); } } });
def(435, 'Furia del clan', 'orco', 'rara', { cost: c(0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, en Frenesí cada ataque +3', plusText: 'Lo que queda de la pelea, en Frenesí cada ataque +4',
  camp: { after: (x) => { x.p.frenzyAtk = (x.p.frenzyAtk || 0) + (x.plus ? 4 : 3); } } });
def(436, 'Lanza de hueso', 'orco', 'comun', { cost: c(0, 2), o: o({ dmg: 4 }), text: 'Daño 4, Furia +1', plusText: 'Daño 6, Furia +1', plus: { o: o({ dmg: 6 }) }, camp: { after: (x) => x.fury(1) } });
def(437, 'Tambor de guerra', 'orco', 'comun', { cost: c(0, 2), kw: ['guardada'], text: 'Este turno, cada ataque que juegues te suma 1 de Furia más', plusText: 'Este turno, cada ataque que juegues te suma 1 de Furia más', plus: { cost: c(0, 1) },
  camp: { after: (x) => { x.p.drumFury = true; } } });

/* ---------- Elfo de campaña: FLECHAS y PUNTERÍA (S03 08/11, docs/campaña/razas.md §1-2). Reemplazan a las 10 élficas viejas (240-249) ----------
   Flecha (440): costo 0, daño 2 + Puntería, Se quema, no gasta jugada; las que no tirás se pierden al terminar el turno. Ojo de águila N: mirás
   las N de arriba del mazo y descartás las que no sirven. La fórmula del daño de la Flecha (también la usa la vista del motor): */
export const ARROW_CFG = { base: 4, aimMax: 99 }; // (S03 08/11) daño base de la Flecha: 3 (el doc decía 2: con 2 el elfo ganaba 3 % de las runs); (S03 10/11) 4: el elfo tardaba 22,5 runs en vencer al Demonio (media 20)
export function arrowDmg(p) { let d = ARROW_CFG.base + Math.min(ARROW_CFG.aimMax, p.aim || 0) + (p.aimTurn || 0) + (p.arrowPlusTurn || 0) + (p.arrowPlus || 0) + (p.nextArrowPlus || 0); if (p.moonSilver) d += p.mage || 0; if (p.nextArrowX2) d *= 2; if (p.arrowMul) d *= p.arrowMul; return d; }
const ARROW = 440;
def(440, 'Flecha', 'elfo', 'comun', { o: o({ dmg: 4 }), kw: ['quema'], text: 'Daño 4 + tu Puntería. No gasta jugada', plusText: 'Daño 4 + tu Puntería. No gasta jugada',
  camp: { can: (p) => !(p.arrowCap && (p.arrowsTurn || 0) >= p.arrowCap), dyn: (x) => { const d = arrowDmg(x.p); if (x.p.arrowPierce) { x.op[6] = 0; x.op[7] = d; } else x.op[6] = d; }, after: (x) => { x.p.arrowsTurn = (x.p.arrowsTurn || 0) + 1; if (x.p.arrowWallTurn) x.p.wall += x.p.arrowWallTurn; if (x.p.splinters && x.p.arrowsTurn === 1) x.arrows(1); x.p.nextArrowX2 = false; x.p.nextArrowPlus = 0; if (x.g) x.g.freePlay = true; } } });
def(441, 'Arco corto', 'elfo', 'comun', { cost: c(0, 0, 2), text: 'Te da 3 Flechas', plusText: 'Te da 4 Flechas', camp: { after: (x) => x.arrows(x.plus ? 4 : 3) } });
def(442, 'Ojo de águila', 'elfo', 'comun', { cost: c(0, 0, 1), text: 'Ojo de águila 3; robás 1', plusText: 'Ojo de águila 4; robás 1', camp: { after: (x) => { x.eye(x.plus ? 4 : 3); x.draw(1); } } });
def(443, 'Puntería', 'elfo', 'comun', { cost: c(0, 0, 2), text: 'Puntería +1 (la pelea) y te da 1 Flecha', plusText: 'Puntería +1 (la pelea) y te da 2 Flechas', camp: { after: (x) => { x.p.aim = (x.p.aim || 0) + 1; x.arrows(x.plus ? 2 : 1); } } });
def(444, 'Lluvia de flechas', 'elfo', 'comun', { cost: c(0, 0, 4), text: 'Te da 3 Flechas', plusText: 'Te da 4 Flechas', camp: { after: (x) => x.arrows(x.plus ? 4 : 3) } });
def(445, 'Flecha de plata', 'elfo', 'comun', { cost: c(0, 0, 2), text: 'Te da 1 Flecha; tu próxima Flecha hace +4', plusText: 'Te da 1 Flecha; tu próxima Flecha hace +6', camp: { after: (x) => { x.arrows(1); x.p.nextArrowPlus = (x.p.nextArrowPlus || 0) + (x.plus ? 6 : 4); } } });
def(446, 'Paso ligero', 'elfo', 'comun', { cost: c(0, 0, 2), text: 'Robás 2', plusText: 'Robás 3', camp: { after: (x) => x.draw(x.plus ? 3 : 2) } });
def(447, 'Viento del bosque', 'elfo', 'comun', { cost: c(0, 0, 3), s: s({ wall: 4 }), text: 'Muro +4 y te da 1 Flecha', plusText: 'Muro +6 y te da 1 Flecha', plus: { s: s({ wall: 6 }) }, camp: { after: (x) => x.arrows(1) } });
def(448, 'Canto de la arboleda', 'elfo', 'comun', { cost: c(0, 0, 3), s: s({ castle: 4 }), text: 'Castillo +4; Ojo de águila 2', plusText: 'Castillo +6; Ojo de águila 2', plus: { s: s({ castle: 6 }) }, camp: { after: (x) => x.eye(2) } });
def(449, 'Arquera veterana', 'elfo', 'poco', { cost: c(0, 0, 5), kw: ['obra'], text: 'Obra: te da 1 Flecha al empezar cada turno tuyo', plusText: 'Obra: te da 1 Flecha al empezar cada turno tuyo', plus: { cost: c(0, 0, 4) },
  camp: { work: { value: 7, tick: (x) => x.arrows(Math.round(x.mult)) } } });
def(450, 'Disparo certero', 'elfo', 'poco', { cost: c(0, 0, 3), kw: ['quema'], text: 'Puntería +2 (la pelea)', plusText: 'Puntería +2 (la pelea); te da 1 Flecha', camp: { after: (x) => { x.p.aim = (x.p.aim || 0) + 2; if (x.plus) x.arrows(1); } } });
def(451, 'Danza de hojas', 'elfo', 'poco', { cost: c(0, 0, 3), s: s({ wall: 0 }), text: 'Muro +2 por cada Flecha en tu mano', plusText: 'Muro +3 por cada Flecha en tu mano',
  camp: { dyn: (x) => { x.s[6] = (x.plus ? 3 : 2) * x.p.hand.filter((h) => h === ARROW || h === ARROW + PLUS).length; } } });
def(452, 'Flechas encadenadas', 'elfo', 'poco', { cost: c(0, 0, 4), text: 'Tus Flechas de este turno hacen +2', plusText: 'Tus Flechas de este turno hacen +3', camp: { after: (x) => { x.p.arrowPlusTurn = (x.p.arrowPlusTurn || 0) + (x.plus ? 3 : 2); x.arrows(1); } } });
def(453, 'Tormenta de flechas', 'elfo', 'rara', { cost: c(0, 0, 7), text: 'Te da 6 Flechas', plusText: 'Te da 8 Flechas', camp: { after: (x) => x.arrows(x.plus ? 8 : 6) } });
def(454, 'Ojo del halcón', 'elfo', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, Ojo de águila 2 al empezar cada turno tuyo', plusText: 'Lo que queda de la pelea, Ojo de águila 2 al empezar cada turno tuyo', plus: { cost: c(0, 0, 4) },
  camp: { after: (x) => { x.p.eyeTurn = (x.p.eyeTurn || 0) + 2; } } });
def(455, 'Precisión élfica', 'elfo', 'rara', { cost: c(0, 0, 6), kw: ['crece'], text: 'Puntería +1. Crece: arrancás cada pelea con Puntería +1 por cada pelea que termines con ella en el mazo', plusText: 'Puntería +2. Crece: arrancás cada pelea con Puntería +1 por cada pelea que termines con ella en el mazo',
  camp: { start: (x) => { x.p.aim = (x.p.aim || 0) + x.growth(455); }, after: (x) => { x.p.aim = (x.p.aim || 0) + (x.plus ? 2 : 1); }, end: (x) => x.grow(455) } });
def(456, 'Rama viva', 'elfo', 'comun', { cost: c(2), s: s({ wall: 4 }), text: 'Muro +4; si este turno tiraste 3 Flechas o más, muro +4 más', plusText: 'Muro +6; si este turno tiraste 3 Flechas o más, muro +4 más', plus: { s: s({ wall: 6 }) },
  camp: { dyn: (x) => { if ((x.p.arrowsTurn || 0) >= 3) x.s[6] += 4; } } });
def(457, 'Hoja afilada', 'elfo', 'comun', { cost: c(0, 0, 1), text: 'Te da 1 Flecha; Puntería +1 este turno', plusText: 'Te da 2 Flechas; Puntería +1 este turno', camp: { after: (x) => { x.arrows(x.plus ? 2 : 1); x.p.aimTurn = (x.p.aimTurn || 0) + 1; } } });
def(458, 'Susurro élfico', 'elfo', 'comun', { cost: c(0, 0, 2), kw: ['guardada'], text: 'Tu próxima Flecha hace el doble', plusText: 'Tu próxima Flecha hace el doble', plus: { cost: c(0, 0, 1) }, camp: { after: (x) => { x.p.nextArrowX2 = true; } } });
CAMP_INFO[440].token = true; CAMP_INFO[440].retired = true; // la Flecha no sale de botín: te la dan las cartas

/* ---------- Gnomo de campaña: CALDERA e INVENTOS (S03 08/11, docs/campaña/razas.md §1-2). Reemplazan a los 10 gnomos viejos (250-259) ----------
   Cada carta suma su presión a la caldera (pressure; 1 si no dice). Al terminar el turno: liberar (daño o muro = presión x1,5) o aguantar;
   si pasa de 10, explota (10 a tu castillo). Inventos (invent): mejoran cada vez que los jugás en la pelea. */
const inv = (x, bid) => (x.p.inv?.[bid] || 0) + (x.p.invBonus || 0);
def(460, 'Válvula', 'gnomo', 'comun', { cost: c(1), text: 'Presión +2; robás 1', plusText: 'Presión +2; robás 2', camp: { pressure: 2, after: (x) => x.draw(x.plus ? 2 : 1) } });
def(461, 'Prototipo', 'gnomo', 'comun', { cost: c(2), o: o({ dmg: 3 }), text: 'Invento: daño 3 (+2 cada vez que lo jugás en la pelea)', plusText: 'Invento: daño 5 (+2 cada vez que lo jugás en la pelea)', plus: { o: o({ dmg: 5 }) },
  camp: { invent: true, dyn: (x) => { x.op[6] += 2 * inv(x, 461); } } });
def(462, 'Remiendo', 'gnomo', 'comun', { cost: c(2), s: s({ wall: 5 }), text: 'Muro +5; presión −2', plusText: 'Muro +7; presión −2', plus: { s: s({ wall: 7 }) }, camp: { pressure: -2 } });
def(463, 'Pistón', 'gnomo', 'comun', { cost: c(3), s: s({ wall: 4 }), text: 'Invento: muro +4 (+2 cada vez que lo jugás en la pelea)', plusText: 'Invento: muro +6 (+2 cada vez que lo jugás en la pelea)', plus: { s: s({ wall: 6 }) },
  camp: { invent: true, dyn: (x) => { x.s[6] += 2 * inv(x, 463); } } });
def(464, 'Silbato de vapor', 'gnomo', 'comun', { cost: c(2), s: s({ w: 2 }), text: 'Presión +3; armas +2', plusText: 'Presión +3; armas +4', plus: { s: s({ w: 4 }) }, camp: { pressure: 3 } });
def(465, 'Tuerca loca', 'gnomo', 'comun', { cost: c(1), text: 'Invento: +1 de tu recurso más bajo (+1 cada vez que lo jugás en la pelea)', plusText: 'Invento: +2 de tu recurso más bajo (+1 cada vez que lo jugás en la pelea)',
  camp: { invent: true, after: (x) => { const k = ['brick', 'weapon', 'crystal'].sort((a, b) => x.p[a] - x.p[b])[0]; x.p[k] += (x.plus ? 2 : 1) + inv(x, 465) - 1; } } });
def(466, 'Liberar', 'gnomo', 'comun', { cost: c(0, 0, 2), text: 'Liberás la caldera ahora: daño igual a la presión x1,5', plusText: 'Liberás la caldera ahora: daño igual a la presión x1,5; robás 1',
  camp: { pressure: 0, can: (p) => (p.pressure || 0) > 0, after: (x) => { x.release('dmg'); if (x.plus) x.draw(1); } } });
def(467, 'Manómetro', 'gnomo', 'comun', { cost: c(0, 0, 1), text: 'Robás 1 (no suma presión)', plusText: 'Robás 2 (no suma presión)', camp: { pressure: 0, after: (x) => x.draw(x.plus ? 2 : 1) } });
def(468, 'Cañón a vapor', 'gnomo', 'poco', { cost: c(5), text: 'Daño igual a la presión x3; la caldera queda en 0', plusText: 'Daño igual a la presión x4; la caldera queda en 0',
  camp: { pressure: 0, can: (p) => (p.pressure || 0) > 0, dyn: (x) => { x.op[6] = (x.p.pressure || 0) * (x.plus ? 4 : 3); }, after: (x) => { x.p.pressure = 0; x.fx.push('boiler:0'); } } });
def(469, 'Taller móvil', 'gnomo', 'poco', { cost: c(5), kw: ['obra'], text: 'Obra: tus Inventos +1 al empezar cada turno tuyo', plusText: 'Obra: tus Inventos +1 al empezar cada turno tuyo', plus: { cost: c(4) },
  camp: { work: { value: 6, tick: (x) => { x.p.invBonus = (x.p.invBonus || 0) + Math.round(x.mult); } } } });
def(470, 'Caldera doble', 'gnomo', 'poco', { cost: c(4), kw: ['quema'], text: 'Lo que queda de la pelea, la caldera aguanta 4 más', plusText: 'Lo que queda de la pelea, la caldera aguanta 6 más',
  camp: { pressure: 0, after: (x) => { x.p.boilerMaxMod = (x.p.boilerMaxMod || 0) + (x.plus ? 6 : 4); } } });
def(471, 'Autómata', 'gnomo', 'poco', { cost: c(6), kw: ['obra'], text: 'Obra: daño 3 al empezar cada turno tuyo; presión +1', plusText: 'Obra: daño 4 al empezar cada turno tuyo; presión +1',
  camp: { work: { value: 8, atk: 0, tick: (x) => { x.hurt(Math.round((x.plus ? 4 : 3) * x.mult)); x.press(1); } } } });
def(472, 'Gran invento', 'gnomo', 'rara', { cost: c(7), o: o({ dmg: 6 }), text: 'Invento: daño 6 (+4 cada vez que lo jugás en la pelea)', plusText: 'Invento: daño 9 (+4 cada vez que lo jugás en la pelea)', plus: { o: o({ dmg: 9 }) },
  camp: { invent: true, dyn: (x) => { x.op[6] += 4 * inv(x, 472); } } });
def(473, 'Sobrepresión', 'gnomo', 'rara', { cost: c(4), kw: ['quema'], text: 'Lo que queda de la pelea, si la caldera explota, el rival también recibe 10', plusText: 'Lo que queda de la pelea, si la caldera explota, el rival también recibe 10; presión +3',
  camp: { pressure: 0, after: (x) => { x.p.overPressure = true; if (x.plus) x.press(3); } } });
def(474, 'Planos maestros', 'gnomo', 'rara', { cost: c(0, 0, 5), kw: ['crece'], text: 'Tus Inventos +1. Crece: arrancás cada pelea con los Inventos +1 por cada pelea que termines con ella en el mazo (hasta +3)', plusText: 'Tus Inventos +2. Crece: arrancás cada pelea con los Inventos +1 por cada pelea que termines con ella en el mazo (hasta +3)',
  camp: { start: (x) => { x.p.invBonus = (x.p.invBonus || 0) + Math.min(3, x.growth(474)); }, after: (x) => { x.p.invBonus = (x.p.invBonus || 0) + (x.plus ? 2 : 1); }, end: (x) => x.grow(474) } });
def(475, 'Engranaje', 'gnomo', 'comun', { cost: c(2), text: 'Invento: robás 1 (+1 carta cada 2 veces que lo jugás en la pelea)', plusText: 'Invento: robás 2 (+1 carta cada 2 veces que lo jugás en la pelea)',
  camp: { invent: true, after: (x) => x.draw((x.plus ? 2 : 1) + Math.floor((inv(x, 475) - 1) / 2)) } });
def(476, 'Chatarra útil', 'gnomo', 'comun', { cost: c(1), s: s({ b: 1, w: 1, cr: 1 }), text: '+1 de cada recurso; presión +1', plusText: '+2 de cada recurso; presión +1', plus: { s: s({ b: 2, w: 2, cr: 2 }) } });
def(477, 'Freno de mano', 'gnomo', 'comun', { cost: c(2), kw: ['guardada'], text: 'Este turno la caldera no explota (se queda en el máximo)', plusText: 'Este turno la caldera no explota (se queda en el máximo)', plus: { cost: c(1) },
  camp: { pressure: 0, after: (x) => { x.p.brakeTurn = true; } } });

/* ---------- Drow de campaña: VENENO y PACTOS (S03 08/11, docs/campaña/razas.md §1-2). Reemplazan a los 10 drows viejos (260-269) ----------
   Veneno en el rival: al empezar SU turno pierde esa cantidad de castillo (ignora el muro) y baja 1. Pacto: para el drow las maldiciones
   y estados se juegan (costo 0): se queman y dan +2 de veneno (VENOM_CFG.pact). */
const isDark = (h) => ['curse', 'state'].includes(CAMPAIGN_CARDS[h]?.[5]?.k); const curseInHand = (p) => p.hand.some(isDark);
def(480, 'Daga envenenada', 'drow', 'comun', { cost: c(0, 2), o: o({ dmg: 3 }), text: 'Daño 3; veneno 3', plusText: 'Daño 4; veneno 4', plus: { o: o({ dmg: 4 }) }, camp: { after: (x) => x.venom(x.plus ? 4 : 3) } });
def(481, 'Pacto oscuro', 'drow', 'comun', { cost: c(0, 0, 1), text: 'Te metés un Miedo; veneno 4', plusText: 'Te metés un Miedo; veneno 6', camp: { after: (x) => { x.give(x.p, 192); x.venom(x.plus ? 6 : 4); } } });
def(482, 'Niebla', 'drow', 'comun', { cost: c(0, 0, 2), s: s({ wall: 4 }), text: 'Muro +4; veneno 2', plusText: 'Muro +6; veneno 3', plus: { s: s({ wall: 6 }) }, camp: { after: (x) => x.venom(x.plus ? 3 : 2) } });
def(483, 'Picadura', 'drow', 'comun', { cost: c(0, 1), text: 'Veneno 4', plusText: 'Veneno 6', camp: { after: (x) => x.venom(x.plus ? 6 : 4) } });
def(484, 'Telarañas', 'drow', 'comun', { cost: c(0, 0, 3), text: 'Veneno 2; el rival no se cura en su próximo turno', plusText: 'Veneno 4; el rival no se cura en su próximo turno', camp: { after: (x) => { x.venom(x.plus ? 4 : 2); x.o.noHealT = 1; } } });
def(485, 'Susurro del abismo', 'drow', 'comun', { cost: c(0, 0, 2), text: 'Jugás gratis una maldición de tu mano (su pacto)', plusText: 'Jugás gratis una maldición de tu mano (su pacto)', plus: { cost: c(0, 0, 1) },
  camp: { can: (p) => p.hand.some(isDark), after: (x) => x.pact() } });
def(486, 'Sangre negra', 'drow', 'comun', { cost: c(0, 0, 3), text: 'Duplicás el veneno del rival (hasta +10)', plusText: 'Duplicás el veneno del rival (hasta +15)', camp: { can: (p) => true, after: (x) => x.venom(Math.min(x.plus ? 15 : 10, x.o.venom || 0)) } });
def(487, 'Sombra', 'drow', 'comun', { cost: c(0, 0, 2), s: s({ wall: 5 }), text: 'Muro +5; +2 si tenés una maldición en la mano', plusText: 'Muro +7; +3 si tenés una maldición en la mano', plus: { s: s({ wall: 7 }) },
  camp: { dyn: (x) => { if (curseInHand(x.p)) x.s[6] += x.plus ? 3 : 2; } } });
def(488, 'Altar de sombras', 'drow', 'poco', { cost: c(0, 0, 5), kw: ['obra'], text: 'Obra: veneno 2 al rival al empezar cada turno tuyo', plusText: 'Obra: veneno 2 al rival al empezar cada turno tuyo', plus: { cost: c(0, 0, 4) },
  camp: { work: { value: 7, tick: (x) => x.venom(Math.round(2 * x.mult)) } } });
def(489, 'Ofrenda', 'drow', 'poco', { cost: blood(2), text: 'Cuesta 2 de vida. Sacás una maldición de tu mazo: veneno 6', plusText: 'Cuesta 2 de vida. Sacás una maldición de tu mazo: veneno 8',
  camp: { can: (p) => [...p.deck, ...p.used].some((h) => CAMPAIGN_CARDS[h]?.[5]?.k === 'curse'), after: (x) => { for (const L of [x.p.deck, x.p.used]) { const i = L.findIndex((h) => CAMPAIGN_CARDS[h]?.[5]?.k === 'curse'); if (i >= 0) { (x.p.burned ||= []).push(L.splice(i, 1)[0]); break; } } x.venom(x.plus ? 8 : 6); } } });
def(490, 'Pacto de sangre', 'drow', 'poco', { cost: c(0, 0, 3), text: 'Veneno 2 por cada maldición que tengas (mazo, descarte y mano)', plusText: 'Veneno 3 por cada maldición que tengas (mazo, descarte y mano)',
  camp: { after: (x) => x.venom((x.plus ? 3 : 2) * x.curses()) } });
def(491, 'Plaga drow', 'drow', 'poco', { cost: c(0, 4), text: 'Veneno 3 y le metés Pánico al rival', plusText: 'Veneno 5 y le metés Pánico al rival', camp: { after: (x) => { x.venom(x.plus ? 5 : 3); x.give(x.o, 194); } } });
def(492, 'Corona de espinas', 'drow', 'rara', { cost: c(0, 0, 6), kw: ['quema'], text: 'Lo que queda de la pelea, tus pactos dan 3 de veneno más', plusText: 'Lo que queda de la pelea, tus pactos dan 3 de veneno más', plus: { cost: c(0, 0, 5) },
  camp: { after: (x) => { x.p.pactBonus = (x.p.pactBonus || 0) + 3; } } });
def(493, 'Catalizador', 'drow', 'rara', { cost: c(0, 0, 5), text: 'El veneno del rival actúa ahora (sin bajar)', plusText: 'El veneno del rival actúa ahora (sin bajar)', plus: { cost: c(0, 0, 4) },
  camp: { can: (p) => true, after: (x) => { const n = x.o.venom || 0; if (n > 0) x.hurt(0, n, x.o, 'veneno'); } } });
def(494, 'Madre araña', 'drow', 'rara', { cost: c(0, 0, 7), kw: ['crece'], text: 'Veneno 5. Crece: arrancás cada pelea con veneno 5 en el rival por cada pelea que termines con ella en el mazo (hasta 15)', plusText: 'Veneno 8. Crece: arrancás cada pelea con veneno 5 en el rival por cada pelea que termines con ella en el mazo (hasta 15)',
  camp: { start: (x) => { x.p.venomStart = (x.p.venomStart || 0) + 5 * Math.min(3, x.growth(494)); }, after: (x) => x.venom(x.plus ? 8 : 5), end: (x) => x.grow(494) } });
def(495, 'Hoja negra', 'drow', 'comun', { cost: c(0, 3), o: o({ dmg: 5 }), text: 'Daño 5; +3 si el rival tiene veneno', plusText: 'Daño 7; +4 si el rival tiene veneno', plus: { o: o({ dmg: 7 }) },
  camp: { dyn: (x) => { if ((x.o?.venom || 0) > 0) x.op[6] += x.plus ? 4 : 3; } } });
def(496, 'Ritual prohibido', 'drow', 'comun', { cost: c(0, 0, 1), text: 'Te metés un Pánico; robás 2', plusText: 'Te metés un Pánico; robás 3', camp: { after: (x) => { x.give(x.p, 194); x.draw(x.plus ? 3 : 2); } } });
def(497, 'Velo', 'drow', 'comun', { cost: c(0, 0, 2), kw: ['guardada'], text: 'El próximo golpe enemigo te hace 5 menos', plusText: 'El próximo golpe enemigo te hace 7 menos', camp: { after: (x) => { x.p.veil = Math.max(x.p.veil || 0, x.plus ? 7 : 5); } } });

/* ---------- Cartas nuevas de docs/campaña/sinergias.md (S03 10/11): 9 por raza y el humano rehecho ---------- */
// Enano (500-508)
def(500, 'Golpe de escudo', 'enano', 'comun', { cost: c(3), text: 'Daño igual a la mitad de tu muro', plusText: 'Daño igual a tu muro x0,75', camp: { dyn: (x) => { x.op[6] = Math.floor(x.p.wall * (x.plus ? 0.75 : 0.5)); } } });
def(501, 'Muralla tallada', 'enano', 'comun', { cost: c(3), s: s({ wall: 4 }), text: 'Muro +4; +1 por cada runa de Piedra', plusText: 'Muro +6; +2 por cada runa de Piedra', plus: { s: s({ wall: 6 }) },
  camp: { dyn: (x) => { x.s[6] += (x.p.runes || []).filter((t) => t === 'piedra').length * (x.plus ? 2 : 1); } } });
def(502, 'Chispazo', 'enano', 'comun', { cost: c(0, 2), o: o({ dmg: 2 }), text: 'Grabá una runa de Fuego; daño 2', plusText: 'Grabá una runa de Fuego; daño 4', plus: { o: o({ dmg: 4 }) }, camp: { after: (x) => x.rune('fuego') } });
def(503, 'Martillo y yunque', 'enano', 'poco', { cost: c(0, 0, 1), rapid: true, text: 'Rompé tu runa más vieja (x3); robás 1', plusText: 'Rompé tu runa más vieja (x3); robás 2',
  camp: { can: (p) => !!(p.runes || []).length && !p.noBreak, after: (x) => { x.breakOld(); x.draw(x.plus ? 2 : 1); } } });
def(504, 'Ladrillo rúnico', 'enano', 'comun', { cost: c(0, 0, 1), s: s({ b: 3 }), text: 'Ladrillos +3; si tenés una runa de Oro, +3 más', plusText: 'Ladrillos +5; si tenés una runa de Oro, +3 más', plus: { s: s({ b: 5 }) },
  camp: { dyn: (x) => { if ((x.p.runes || []).includes('oro')) x.s[1] += 3; } } });
def(505, 'Maestro cantero', 'enano', 'poco', { cost: c(5), kw: ['obra'], text: 'Obra: al empezar tu turno, muro +1 por cada constructor', plusText: 'Obra: al empezar tu turno, muro +1 por cada constructor', plus: { cost: c(4) },
  camp: { work: { value: 6, tick: (x) => { x.p.wall += (x.p.builder || 0) * Math.round(x.mult); } } } });
def(506, 'Cuarta ranura', 'enano', 'rara', { cost: c(0, 0, 4), kw: ['quema'], text: 'Lo que queda de la pelea, tenés una ranura de runa más', plusText: 'Lo que queda de la pelea, tenés una ranura de runa más; grabá una Piedra',
  camp: { after: (x) => { x.p.runeSlots = (x.p.runeSlots || 3) + 1; if (x.plus) x.rune('piedra'); } } });
def(507, 'Montaña viva', 'enano', 'rara', { cost: c(6), kw: ['quema'], text: 'Lo que queda de la pelea, al empezar tu turno daño igual a tu muro ÷ 4', plusText: 'Lo que queda de la pelea, al empezar tu turno daño igual a tu muro ÷ 4', plus: { cost: c(5) },
  camp: { after: (x) => { x.p.livingMountain = true; } } });
def(508, 'Tesoro de la montaña', 'enano', 'rara', { cost: c(0, 0, 4), kw: ['quema'], text: 'Lo que queda de la pelea, las runas de Oro al romperse dan además +5 de cada recurso; grabá una de Oro', plusText: 'Lo que queda de la pelea, las runas de Oro al romperse dan además +5 de cada recurso; grabá dos de Oro',
  camp: { after: (x) => { x.p.oroTreasure = true; x.rune('oro', x.plus ? 2 : 1); } } });
// Orco (510-518)
def(510, 'Festín', 'orco', 'comun', { cost: c(0, 3), o: o({ dmg: 6 }), text: 'Daño 6; si el rival tiene menos muro que vos, curás 4', plusText: 'Daño 8; si el rival tiene menos muro que vos, curás 5', plus: { o: o({ dmg: 8 }) },
  camp: { after: (x) => { if (x.o.wall < x.p.wall && !x.p.noHeal) x.p.castle += x.plus ? 5 : 4; } } });
def(511, 'Sangre por sangre', 'orco', 'poco', { cost: c(0, 2), text: 'Curás la mitad del daño que hiciste este turno (máx. 12)', plusText: 'Curás la mitad del daño que hiciste este turno (máx. 16)',
  camp: { can: (p) => (p.dmgTurn || 0) > 0, after: (x) => { if (!x.p.noHeal) x.p.castle += Math.min(x.plus ? 16 : 12, Math.floor((x.p.dmgTurn || 0) / 2)); } } });
def(512, 'Trofeo de guerra', 'orco', 'rara', { cost: c(0, 5), o: o({ dmg: 10 }), text: 'Daño 10; si deja al rival sin muro o sin castillo, +3 de vida máxima en la run', plusText: 'Daño 13; si deja al rival sin muro o sin castillo, +3 de vida máxima en la run', plus: { o: o({ dmg: 13 }) },
  camp: { after: (x) => { if ((x.o.wall <= 0 || x.o.castle <= 0) && !x.p.rs?.trophy) { x.p.hpMaxUp = (x.p.hpMaxUp || 0) + 3; x.fx.push('camp:trophy'); } } } });
def(513, 'Carga de la horda', 'orco', 'comun', { cost: c(0, 3), text: 'Daño 2 por cada soldado', plusText: 'Daño 3 por cada soldado', camp: { dyn: (x) => { x.op[6] = (x.plus ? 3 : 2) * (x.p.recruit || 0); } } });
def(514, 'Leva orca', 'orco', 'comun', { cost: c(0, 3), s: s({ so: 1 }), text: 'Soldados +1 (esta pelea); Furia +1', plusText: 'Soldados +1 (esta pelea); Furia +2', camp: { after: (x) => x.fury(x.plus ? 2 : 1) } });
def(515, 'Forja de guerra', 'orco', 'poco', { cost: c(2), text: 'Armas +2 por cada soldado', plusText: 'Armas +3 por cada soldado', camp: { dyn: (x) => { x.s[3] += (x.plus ? 3 : 2) * (x.p.recruit || 0); } } });
def(516, 'Aullido', 'orco', 'comun', { cost: c(0, 1), rapid: true, text: 'Furia +2; robás 1', plusText: 'Furia +3; robás 1', camp: { after: (x) => { x.fury(x.plus ? 3 : 2); x.draw(1); } } });
def(517, 'Ira contenida', 'orco', 'poco', { cost: c(0, 2), kw: ['guardada'], text: 'Si la tenés en la mano al empezar tu turno, Furia +2. Jugada: Furia +3', plusText: 'Si la tenés en la mano al empezar tu turno, Furia +2. Jugada: Furia +5', camp: { after: (x) => x.fury(x.plus ? 5 : 3) } });
def(518, 'Señor de la guerra', 'orco', 'rara', { cost: c(0, 6), kw: ['quema'], text: 'Lo que queda de la pelea, cada soldado suma +1 al daño de tus ataques', plusText: 'Lo que queda de la pelea, cada soldado suma +1 al daño de tus ataques; soldados +1', plus: { s: s({ so: 1 }) },
  camp: { after: (x) => { x.p.warlord = true; } } });
// Elfo (520-528)
def(520, 'Carcaj lleno', 'elfo', 'comun', { cost: c(0, 0, 2), text: 'Te da 2 Flechas; si ya tenés 2 o más en la mano, 1 más', plusText: 'Te da 3 Flechas; si ya tenés 2 o más en la mano, 1 más',
  camp: { after: (x) => { const had = x.p.hand.filter((h) => h === ARROW || h === ARROW + PLUS).length; x.arrows((x.plus ? 3 : 2) + (had >= 2 ? 1 : 0)); } } });
def(521, 'Sombra del bosque', 'elfo', 'poco', { cost: c(0, 0, 2), text: 'Lo que queda del turno, cada Flecha que tirás te da muro +1; te da 1 Flecha', plusText: 'Lo que queda del turno, cada Flecha que tirás te da muro +2; te da 1 Flecha',
  camp: { after: (x) => { x.p.arrowWallTurn = x.plus ? 2 : 1; x.arrows(1); } } });
def(522, 'Mil astillas', 'elfo', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, la primera Flecha de cada turno se copia a tu mano', plusText: 'Lo que queda de la pelea, la primera Flecha de cada turno se copia a tu mano; te da 2 Flechas',
  camp: { after: (x) => { x.p.splinters = true; if (x.plus) x.arrows(2); } } });
def(523, 'Respirar', 'elfo', 'comun', { cost: c(0, 0, 1), rapid: true, text: 'Puntería +1; Ojo de águila 1', plusText: 'Puntería +1; Ojo de águila 3', camp: { after: (x) => { x.p.aim = (x.p.aim || 0) + 1; x.eye(x.plus ? 3 : 1); } } });
def(524, 'Tiro al corazón', 'elfo', 'poco', { cost: c(0, 0, 3), kw: ['quema'], text: 'Daño igual a tu Puntería x3', plusText: 'Daño igual a tu Puntería x4', camp: { dyn: (x) => { x.op[6] = ((x.p.aim || 0) + (x.p.aimTurn || 0)) * (x.plus ? 4 : 3); } } });
def(525, 'Ojo infalible', 'elfo', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, tus Flechas ignoran el muro', plusText: 'Lo que queda de la pelea, tus Flechas ignoran el muro; te da 2 Flechas', camp: { after: (x) => { x.p.arrowPierce = true; if (x.plus) x.arrows(2); } } });
def(526, 'Flecha de cristal', 'elfo', 'comun', { cost: c(1), s: s({ cr: 3 }), text: 'Cristales +3; te da 1 Flecha', plusText: 'Cristales +5; te da 1 Flecha', plus: { s: s({ cr: 5 }) }, camp: { after: (x) => x.arrows(1) } });
def(527, 'Arquero arcano', 'elfo', 'poco', { cost: c(0, 0, 5), kw: ['obra'], text: 'Obra: cada 2 turnos, 1 Flecha por cada mago', plusText: 'Obra: cada 2 turnos, 1 Flecha por cada mago', plus: { cost: c(0, 0, 4) },
  camp: { work: { value: 6, tick: (x) => { x.p.rs = { ...(x.p.rs || {}), arcT: ((x.p.rs || {}).arcT || 0) + 1 }; if (x.p.rs.arcT % 2 === 0) x.arrows(Math.min(4, (x.p.mage || 0) * Math.round(x.mult))); } } } });
def(528, 'Luna de plata', 'elfo', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, tus Flechas hacen +1 por cada mago', plusText: 'Lo que queda de la pelea, tus Flechas hacen +1 por cada mago; magos +1', plus: { s: s({ ma: 1 }) }, camp: { after: (x) => { x.p.moonSilver = true; } } });
// Gnomo (530-538)
def(530, 'Recalibrar', 'gnomo', 'comun', { cost: c(1), rapid: true, text: 'Volvé a tu mano el último Invento que jugaste', plusText: 'Volvé a tu mano el último Invento que jugaste; presión −1',
  camp: { pressure: 0, can: (p) => p.lastInvent != null && p.used.includes(p.lastInvent), after: (x) => { const i = x.p.used.lastIndexOf(x.p.lastInvent); if (i >= 0) x.p.hand.push(x.p.used.splice(i, 1)[0]); if (x.plus) x.press(-1); } } });
def(531, 'Cinta transportadora', 'gnomo', 'poco', { cost: c(2), text: 'Robás tu Invento más fuerte del mazo', plusText: 'Robás tu Invento más fuerte del mazo y robás 1',
  camp: { pressure: 0, after: (x) => { const L = [...x.p.deck, ...x.p.used].filter((h) => CAMPAIGN_CARDS[h]?.[5]?.camp?.invent); const best = L.sort((a, b) => ((x.p.inv || {})[b % PLUS] || 0) - ((x.p.inv || {})[a % PLUS] || 0))[0]; if (best != null) { for (const Q of [x.p.deck, x.p.used]) { const i = Q.indexOf(best); if (i >= 0) { Q.splice(i, 1); break; } } x.p.hand.push(best); } if (x.plus) x.draw(1); } } });
def(532, 'Fábrica', 'gnomo', 'rara', { cost: c(6), kw: ['quema'], text: 'Lo que queda de la pelea, al empezar tu turno vuelve a tu mano el Invento más fuerte de tu descarte', plusText: 'Lo que queda de la pelea, al empezar tu turno vuelve a tu mano el Invento más fuerte de tu descarte', plus: { cost: c(5) },
  camp: { pressure: 0, after: (x) => { x.p.factory = true; } } });
def(533, 'Calentar', 'gnomo', 'comun', { cost: c(2), s: s({ wall: 3 }), text: 'Presión +2; muro +3', plusText: 'Presión +2; muro +6', plus: { s: s({ wall: 6 }) }, camp: { pressure: 2 } });
def(534, 'Vapor a presión', 'gnomo', 'poco', { cost: c(2), text: 'Si la presión está a 2 del máximo o menos, daño 12', plusText: 'Si la presión está a 3 del máximo o menos, daño 15',
  camp: { pressure: 0, dyn: (x) => { const mx = 10 + (x.p.boilerMaxMod || 0); if ((x.p.pressure || 0) >= mx - (x.plus ? 3 : 2)) x.op[6] = x.plus ? 15 : 12; } } });
def(535, 'Válvula maestra', 'gnomo', 'rara', { cost: c(4), kw: ['quema'], text: 'Lo que queda de la pelea, cuando la caldera explotaría se libera sola: daño igual a la presión', plusText: 'Lo que queda de la pelea, cuando la caldera explotaría se libera sola: daño igual a la presión; presión +3',
  camp: { pressure: 0, after: (x) => { x.p.autoRelease = true; if (x.plus) x.press(3); } } });
def(536, 'Cristal de energía', 'gnomo', 'comun', { cost: c(1), s: s({ cr: 3 }), text: 'Cristales +3; presión +1', plusText: 'Cristales +5; presión +1', plus: { s: s({ cr: 5 }) } });
def(537, 'Aprendiz de mago', 'gnomo', 'poco', { cost: c(0, 0, 4), s: s({ ma: 1 }), text: 'Magos +1 (esta pelea); tus Inventos +1', plusText: 'Magos +1 (esta pelea); tus Inventos +2', camp: { after: (x) => { x.p.invBonus = (x.p.invBonus || 0) + (x.plus ? 2 : 1); } } });
def(538, 'Gran taller', 'gnomo', 'rara', { cost: c(6), kw: ['quema'], text: 'Lo que queda de la pelea, tus Obras actúan dos veces al empezar tu turno', plusText: 'Lo que queda de la pelea, tus Obras actúan dos veces al empezar tu turno', plus: { cost: c(5) },
  camp: { pressure: 0, after: (x) => { x.p.workDouble = true; } } });
// Drow (540-548)
def(540, 'Gota a gota', 'drow', 'comun', { cost: c(0, 1), rapid: true, text: 'Veneno 2', plusText: 'Veneno 3', camp: { after: (x) => x.venom(x.plus ? 3 : 2) } });
def(541, 'Ponzoña lenta', 'drow', 'poco', { cost: c(0, 0, 4), kw: ['quema'], text: 'Lo que queda de la pelea, el veneno del rival no baja al actuar', plusText: 'Lo que queda de la pelea, el veneno del rival no baja al actuar; veneno 3', camp: { after: (x) => { x.p.venomNoDecay = true; if (x.plus) x.venom(3); } } });
def(542, 'Plaga reina', 'drow', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, al empezar tu turno veneno +1 por cada maldición de tu mazo', plusText: 'Lo que queda de la pelea, al empezar tu turno veneno +1 por cada maldición de tu mazo; te metés un Miedo',
  camp: { after: (x) => { x.p.plagueQueen = true; if (x.plus) x.give(x.p, 192); } } });
def(543, 'Pacto cumplido', 'drow', 'comun', { cost: c(0, 0, 1), text: 'Jugás una maldición de tu mano (su pacto); robás 1', plusText: 'Jugás una maldición de tu mano (su pacto); robás 2',
  camp: { can: (p) => p.hand.some((h) => ['curse', 'state'].includes(CAMPAIGN_CARDS[h]?.[5]?.k)), after: (x) => { x.pact(); x.draw(x.plus ? 2 : 1); } } });
def(544, 'Sello del pacto', 'drow', 'poco', { cost: c(0, 0, 3), kw: ['quema'], text: 'Lo que queda de la pelea, las maldiciones no ocupan lugar en tu mano', plusText: 'Lo que queda de la pelea, las maldiciones no ocupan lugar en tu mano; robás 1', camp: { after: (x) => { x.p.sealPact = true; if (x.plus) x.draw(1); } } });
def(545, 'Señora de los pactos', 'drow', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, cada maldición que robás te da muro +3 y le pone 2 de veneno al rival', plusText: 'Lo que queda de la pelea, cada maldición que robás te da muro +3 y le pone 2 de veneno al rival', plus: { cost: c(0, 0, 4) },
  camp: { after: (x) => { x.p.ladyPact = true; } } });
def(546, 'Manto de sombra', 'drow', 'comun', { cost: c(0, 0, 2), s: s({ wall: 3 }), text: 'Muro +3; el próximo golpe enemigo te hace 4 menos', plusText: 'Muro +5; el próximo golpe enemigo te hace 4 menos', plus: { s: s({ wall: 5 }) }, camp: { after: (x) => { x.p.veil = Math.max(x.p.veil || 0, 4); } } });
def(547, 'Telaraña de sombras', 'drow', 'poco', { cost: c(0, 0, 2), text: 'Muro igual al veneno del rival', plusText: 'Muro igual al veneno del rival +3', camp: { dyn: (x) => { x.s[6] = (x.o?.venom || 0) + (x.plus ? 3 : 0); } } });
def(548, 'Reina de la noche', 'drow', 'rara', { cost: c(0, 0, 5), kw: ['quema'], text: 'Lo que queda de la pelea, mientras tengas Velo tus cartas de veneno dan el doble; Velo 4', plusText: 'Lo que queda de la pelea, mientras tengas Velo tus cartas de veneno dan el doble; Velo 6',
  camp: { after: (x) => { x.p.queenNight = true; x.p.veil = Math.max(x.p.veil || 0, x.plus ? 6 : 4); } } });
// Humano rehecho: Ejército, Corona y Estandartes (550-566)
def(550, 'Recluta', 'humano', 'comun', { cost: c(0, 3), s: s({ so: 1 }), text: 'Soldados +1 (esta pelea)', plusText: 'Soldados +1 (esta pelea); armas +2', plus: { s: s({ so: 1, w: 2 }) } });
def(551, 'Cuadrilla', 'humano', 'comun', { cost: c(3), s: s({ bu: 1, wall: 2 }), text: 'Constructores +1 (esta pelea); muro +2', plusText: 'Constructores +1 (esta pelea); muro +4', plus: { s: s({ bu: 1, wall: 4 }) } });
def(552, 'Aprendices', 'humano', 'comun', { cost: c(0, 0, 3), s: s({ ma: 1, cr: 2 }), text: 'Magos +1 (esta pelea); cristales +2', plusText: 'Magos +1 (esta pelea); cristales +4', plus: { s: s({ ma: 1, cr: 4 }) } });
def(553, 'Carga de caballería', 'humano', 'comun', { cost: c(0, 4), text: 'Daño 2 por cada soldado', plusText: 'Daño 3 por cada soldado', camp: { dyn: (x) => { x.op[6] = (x.plus ? 3 : 2) * (x.p.recruit || 0); } } });
def(554, 'Murallas del pueblo', 'humano', 'comun', { cost: c(3), text: 'Muro +2 por cada constructor', plusText: 'Muro +3 por cada constructor', camp: { dyn: (x) => { x.s[6] = (x.plus ? 3 : 2) * (x.p.builder || 0); } } });
def(555, 'Instrucción', 'humano', 'poco', { cost: c(0, 0, 1), rapid: true, text: 'Tus unidades producen una vez más ahora', plusText: 'Tus unidades producen una vez más ahora; robás 1',
  camp: { after: (x) => { x.p.brick += x.p.builder || 0; x.p.weapon += x.p.recruit || 0; x.p.crystal += x.p.mage || 0; if (x.plus) x.draw(1); } } });
def(556, 'Gran ejército', 'humano', 'rara', { cost: c(4, 4, 4), kw: ['quema'], text: 'Lo que queda de la pelea, tus unidades producen el doble', plusText: 'Lo que queda de la pelea, tus unidades producen el doble', plus: { cost: c(3, 3, 3) }, camp: { after: (x) => { x.p.prodMul = 2; } } });
def(557, 'Cofre de guerra', 'humano', 'comun', { cost: c(0, 0, 2), text: '+12 de oro (de la run); robás 1', plusText: '+18 de oro (de la run); robás 1', camp: { after: (x) => { x.p.gold = (x.p.gold || 0) + (x.plus ? 18 : 12); x.draw(1); } } });
def(558, 'Paga de la tropa', 'humano', 'poco', { o: o({ dmg: 6 }), s: s({ so: 2 }), text: 'Pagás 20 de oro: soldados +2 (esta pelea) y daño 6', plusText: 'Pagás 15 de oro: soldados +2 (esta pelea) y daño 8', plus: { o: o({ dmg: 8 }), camp: { gold: 15 } }, camp: { gold: 20 } });
def(559, 'Rescate del rey', 'humano', 'poco', { o: o({ dmg: 16 }), text: 'Pagás 30 de oro: daño 16', plusText: 'Pagás 25 de oro: daño 20', plus: { o: o({ dmg: 20 }), camp: { gold: 25 } }, camp: { gold: 30 } });
def(560, 'Tesoro real', 'humano', 'rara', { cost: c(0, 0, 5), kw: ['obra'], text: 'Obra: +4 de oro al empezar tu turno; si tenés 100 o más, además daño 5', plusText: 'Obra: +6 de oro al empezar tu turno; si tenés 100 o más, además daño 5',
  camp: { work: { value: 7, tick: (x) => { x.p.gold = (x.p.gold || 0) + (x.plus ? 6 : 4) * Math.round(x.mult); if (x.p.gold >= 100) x.hurt(5); } } } });
def(561, 'Orden de ataque', 'humano', 'comun', { cost: c(0, 1), rapid: true, text: 'Tu próximo ataque este turno hace +4', plusText: 'Tu próximo ataque este turno hace +6', camp: { after: (x) => { x.p.nextAtk = (x.p.nextAtk || 0) + (x.plus ? 6 : 4); } } });
def(562, 'Formación', 'humano', 'comun', { cost: c(3), s: s({ wall: 5 }), text: 'Muro +5; tu próxima carta de muro da +3', plusText: 'Muro +7; tu próxima carta de muro da +3', plus: { s: s({ wall: 7 }) }, camp: { after: (x) => { x.p.nextWall = 3; } } });
def(563, 'Toque de clarín', 'humano', 'poco', { cost: c(0, 2), text: 'Robás 2; tu próximo ataque +2', plusText: 'Robás 2; tu próximo ataque +4', camp: { after: (x) => { x.draw(2); x.p.nextAtk = (x.p.nextAtk || 0) + (x.plus ? 4 : 2); } } });
def(564, 'Estandarte alzado', 'humano', 'poco', { cost: c(0, 3), kw: ['guardada'], text: 'Mientras esté en tu mano, tus ataques +2. Jugada: muro +4', plusText: 'Mientras esté en tu mano, tus ataques +2. Jugada: muro +7', s: s({ wall: 4 }), plus: { s: s({ wall: 7 }) } });
def(565, 'Rey al frente', 'humano', 'rara', { cost: c(0, 0, 6), kw: ['quema'], text: 'Lo que queda de la pelea, la primera carta de cada turno se juega dos veces', plusText: 'Lo que queda de la pelea, la primera carta de cada turno se juega dos veces', plus: { cost: c(0, 0, 5) }, camp: { after: (x) => { x.p.kingFront = true; } } });
def(566, 'Ley marcial', 'humano', 'rara', { cost: c(0, 4), kw: ['quema'], text: 'Lo que queda de la pelea, cada carta de unidades que jugás hace daño 3', plusText: 'Lo que queda de la pelea, cada carta de unidades que jugás hace daño 3; soldados +1', plus: { s: s({ so: 1 }) }, camp: { after: (x) => { x.p.martialLaw = true; } } });
for (let id = 220; id <= 229; id++) CAMP_INFO[id].retired = true;
for (let id = 260; id <= 269; id++) CAMP_INFO[id].retired = true; // los drows viejos: los reemplazan los de Veneno
for (let id = 250; id <= 259; id++) CAMP_INFO[id].retired = true; // los gnomos viejos: los reemplazan los de Caldera
for (let id = 240; id <= 249; id++) CAMP_INFO[id].retired = true; // las élficas viejas: las reemplazan las de Flechas
for (let id = 230; id <= 239; id++) CAMP_INFO[id].retired = true; // las orcas viejas: las reemplazan las de Furia // (S03 08/11) las enanas viejas: las reemplazan las de runas (siguen andando en mazos guardados; no salen más de botín)
export const CAMP_IDS = Object.keys(CAMP_INFO).map(Number);
// (S03 10/11, pedido de S10) las básicas del mazo inicial también tienen versión + (los vectores están en cards.js: BASIC_PLUS)
export const BASIC_PLUS = new Set([2, 6, 8, 30, 34, 36, 37, 54, 60, 62, 63, 64]);
export const hasPlus = (id) => !!CAMP_INFO[id] || BASIC_PLUS.has(id);
export const plusOf = (id) => (hasPlus(id) ? id + PLUS : id);
export const baseOf = (id) => (id > PLUS ? id - PLUS : id);
export const isPlus = (id) => id > PLUS;
