// Razas: cada una tiene una habilidad pasiva (siempre activa) y 10 cartas exclusivas: 8 comunes, 1 rara (muy fuerte, 1 copia) y 1 legendaria (cambia la partida, 1 copia).
export const RACES = {
  humano: { name: 'Humanos', passive: 'Cada turno producen +1 del recurso que menos tienen (si tienen menos de 6) y muro +1 si tienen menos de 10', cards: [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 130, 131, 132, 168, 169], favor: 'Oro' },
  enano:  { name: 'Enanos', passive: 'Las cartas de muro dan +3', cards: [72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 133, 134, 135, 170, 171], favor: 'Runas' },
  elfo:   { name: 'Elfos', passive: 'Pueden cambiar 2 cartas por turno en vez de 1, y las cartas de cristales cuestan 2 cristales menos (mínimo 1)', cards: [82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 136, 137, 138, 172, 173], favor: 'Savia' },
  drow:   { name: 'Elfos oscuros', passive: 'Las cartas que le quitan recursos al rival quitan el doble', cards: [92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 139, 140, 141, 174, 175], favor: 'Sombra' },
  gnomo:  { name: 'Gnomos', passive: 'Las cartas de 6 armas o más cuestan 1 menos, y contra un muro de 25 o más sus ataques de 10 o más hacen además 4 directo al castillo', cards: [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 142, 143, 144, 176, 177], favor: 'Engranajes' },
  orco:   { name: 'Orcos', passive: 'Cada ataque de 6 o más de daño hace +1, pero las cartas de muro dan 1 menos', cards: [112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 145, 146, 147, 178, 179], favor: 'Sangre' },
};
export const raceOf = (id) => Object.keys(RACES).find((k) => RACES[k].cards.includes(id)) || null;
export const RARE_RACE = new Set([70, 80, 90, 100, 110, 120]);
export const LEGENDARY = new Set([71, 81, 91, 101, 111, 121]);
const Z = [0, 0, 0, 0, 0, 0, 0, 0];
const c = (b = 0, w = 0, cr = 0) => [0, b, 0, w, 0, cr, 0, 0];   // costo: ladrillos, armas, cristales
const s = ({ b = 0, w = 0, cr = 0, bu = 0, so = 0, ma = 0, wall = 0, castle = 0 } = {}) => [bu, b, so, w, ma, cr, wall, castle];
const o = ({ b = 0, w = 0, cr = 0, bu = 0, so = 0, ma = 0, dmg = 0, direct = 0 } = {}) => [bu, b, so, w, ma, cr, dmg, direct];
// [nombre, texto, costo, propio, rival, efecto especial (opcional)]
export const RACE_CARDS = {
  // Humanos: adaptación y economía
  62: ['Diezmo', 'Armas +3, cristales +3', c(4), s({ w: 3, cr: 3 }), Z],
  63: ['Cosecha', 'Ladrillos +6, armas +3', c(0, 0, 6), s({ b: 6, w: 3 }), Z],
  64: ['Milicia', 'Soldados +1, muro +2', c(0, 7), s({ so: 1, wall: 2 }), Z],
  65: ['Gremio', 'Constructores +1, armas +2', c(10), s({ bu: 1, w: 2 }), Z],
  66: ['Feria', 'Cristales +8', c(3, 3), s({ cr: 8 }), Z],
  67: ['Reclutas', 'Soldados +2', c(0, 14), s({ so: 2 }), Z],
  68: ['Catedral', 'Castillo +16, muro +4', c(14, 0, 6), s({ castle: 16, wall: 4 }), Z],
  69: ['Diplomacia', 'Rival −5 armas, vos +5 armas', c(0, 0, 10), s({ w: 5 }), o({ w: 5 })],
  70: ['Rey justo', 'Castillo +12, muro +12 y +1 de cada unidad', c(12, 0, 12), s({ castle: 12, wall: 12, bu: 1, so: 1, ma: 1 }), Z],
  71: ['Edicto real', 'Castillo y muro de los dos quedan en el promedio; vos +1 de cada unidad', c(15, 15, 15), s({ bu: 1, so: 1, ma: 1 }), Z, { k: 'edicto' }],
  // Enanos: defensa y obra
  72: ['Mina', 'Ladrillos +9', c(0, 0, 5), s({ b: 9 }), Z],
  73: ['Portón', 'Muro +12', c(5), s({ wall: 12 }), Z],
  74: ['Bastión', 'Muro +14, castillo +8', c(16), s({ wall: 14, castle: 8 }), Z],
  75: ['Yunque', 'Muro +13', c(4, 3), s({ wall: 13 }), Z],
  76: ['Túnel enano', '8 directo al castillo rival', c(11), Z, o({ direct: 8 })],
  77: ['Cerveza', 'Todos producen ladrillos el próximo turno; castillo +4', c(0, 0, 6), s({ castle: 4 }), Z, { k: 'allBrick' }],
  78: ['Muralla ancestral', 'Muro +30', c(14), s({ wall: 30 }), Z],
  79: ['Ingenieros', 'Castillo +7, muro +7', c(9), s({ castle: 7, wall: 7 }), Z],
  80: ['Corazón de la montaña', 'Castillo +22, muro +10, constructores +1', c(18, 0, 8), s({ castle: 22, wall: 10, bu: 1 }), Z],
  81: ['Puerta de la montaña', 'Todo tu muro pasa al castillo', c(20), Z, Z, { k: 'wallToCastle' }],
  // Elfos: tempo y precisión
  82: ['Visión', 'Cambiás las 2 cartas más caras que no podés pagar', c(0, 0, 4), Z, Z, { k: 'cycle2' }],
  83: ['Flecha élfica', 'Daño 10', c(0, 5), Z, o({ dmg: 10 })],
  84: ['Lluvia de flechas', 'Daño 15 y rival −3 armas', c(0, 13), Z, o({ dmg: 15, w: 3 })],
  85: ['Bosque sagrado', 'Muro +11, cristales +3', c(0, 0, 10), s({ wall: 11, cr: 3 }), Z],
  86: ['Canción', 'Magos +1', c(0, 0, 5), s({ ma: 1 }), Z],
  87: ['Arquería', 'Soldados +1, armas +5', c(0, 9), s({ so: 1, w: 5 }), Z],
  88: ['Destello', 'Daño 10 y escudo', c(0, 0, 16), Z, o({ dmg: 10 }), { k: 'shield' }],
  89: ['Trance', 'El próximo turno producís el doble de cristales', c(0, 0, 10), Z, Z, { k: 'doubleCrystal' }],
  90: ['Arco de luna', '20 directo al castillo rival', c(0, 10, 10), Z, o({ direct: 20 })],
  91: ['Reloj de arena', 'Jugás 2 cartas más este turno', c(0, 0, 18), Z, Z, { k: 'extraTurn' }],
  // Elfos oscuros: sabotaje y maldiciones
  92: ['Veneno', 'Rival −6 ladrillos y −6 armas', c(0, 0, 5), Z, o({ b: 6, w: 6 })],
  93: ['Asesino', 'Rival −1 soldado y daño 6', c(0, 9), Z, o({ so: 1, dmg: 6 })],
  94: ['Sombras', 'Escudo y rival −5 cristales', c(0, 0, 7), Z, o({ cr: 5 }), { k: 'shield' }],
  95: ['Espía oscuro', 'Mirás la mano rival', c(0, 2), Z, Z, { k: 'spy' }],
  96: ['Saboteador', 'Descartás 1 carta de la mano rival (sale del juego)', c(0, 6), Z, Z, { k: 'sabotage' }],
  97: ['Pacto', 'Castillo +16, muro −4', c(0, 0, 12), s({ castle: 16, wall: -4 }), Z],
  98: ['Maldición', 'Rival −1 de cada unidad', c(0, 0, 17), Z, o({ bu: 1, so: 1, ma: 1 })],
  99: ['Incursión', 'Daño 13 y armas +4', c(0, 11), s({ w: 4 }), o({ dmg: 13 })],
  100: ['Reina araña', 'Rival −8 de cada recurso y daño 12', c(0, 0, 18), Z, o({ b: 8, w: 8, cr: 8, dmg: 12 })],
  101: ['Traición real', 'Rival −12 de cada recurso, −1 de cada unidad y no produce el próximo turno', c(0, 0, 22), Z, o({ b: 12, w: 12, cr: 12, bu: 1, so: 1, ma: 1 }), { k: 'block' }],
  // Gnomos: máquinas e inventos
  102: ['Engranaje', 'Muro +5, armas +2', c(0, 4), s({ wall: 5, w: 2 }), Z],
  103: ['Ballesta de repetición', 'Daño 11', c(0, 8), Z, o({ dmg: 11 })],
  104: ['Taller gnomo', 'Constructores +1, armas +3', c(7), s({ bu: 1, w: 3 }), Z],
  105: ['Autómata', 'Soldados +2, muro +4', c(0, 14), s({ so: 2, wall: 4 }), Z],
  106: ['Invento', 'Moneda: +10 de cada recurso o −3 de cada', c(0, 0, 6), Z, Z, { k: 'coin', heads: { self: s({ b: 10, w: 10, cr: 10 }) }, tails: { selfCost: s({ b: 3, w: 3, cr: 3 }) } }],
  107: ['Catapulta gnoma', 'Daño 14; moneda: +6 de daño', c(0, 12), Z, o({ dmg: 14 }), { k: 'coin', heads: { opp: o({ dmg: 6 }) } }],
  108: ['Globo', '6 directo al castillo rival', c(0, 0, 9), Z, o({ direct: 6 })],
  109: ['Reparación', 'Muro +6, castillo +2', c(6), s({ wall: 6, castle: 2 }), Z],
  110: ['Gran máquina', 'Daño 24, muro +6', c(0, 20), s({ wall: 6 }), o({ dmg: 24 })],
  111: ['Máquina del fin del mundo', 'Moneda (60%): 40 de daño al rival; si falla, 20 de daño a vos', c(0, 25), Z, Z, { k: 'coin', p: 0.6, heads: { opp: o({ dmg: 40 }) }, tails: { selfDmg: o({ dmg: 20 }) } }],
  // Orcos: agresión y hordas
  112: ['Grito', 'Daño 5', c(0, 3), Z, o({ dmg: 5 })],
  113: ['Horda menor', 'Soldados +2', c(0, 10), s({ so: 2 }), Z],
  114: ['Berserker', 'Daño 12, tu muro −3', c(0, 8), s({ wall: -3 }), o({ dmg: 12 })],
  115: ['Saqueadores', 'Daño 6; rival −4 ladrillos, vos +4', c(0, 9), s({ b: 4 }), o({ dmg: 6, b: 4 })],
  116: ['Trofeos', 'Armas +6', c(0, 0, 5), s({ w: 6 }), Z],
  117: ['Jabalíes', 'Daño 7 y rival −2 cristales', c(0, 6), Z, o({ dmg: 7, cr: 2 })],
  118: ['Chamán', 'Daño 8, cristales +2', c(0, 0, 8), s({ cr: 2 }), o({ dmg: 8 })],
  119: ['Empalizada orca', 'Muro +6', c(5), s({ wall: 6 }), Z],
  120: ['Jefe de guerra', 'Daño 18, soldados +1 y tu próximo ataque hace el doble', c(0, 16), s({ so: 1 }), o({ dmg: 18 }), { k: 'double' }],
  121: ['Horda', 'Todos tus soldados atacan: daño igual a tus armas más 3 por soldado, +1; perdés todas las armas', c(0, 12), Z, Z, { k: 'horde' }],
};
// Reyes: cada raza tiene un rey en el balcón del castillo. Carga 1 por turno propio y al completar el período actúa.
export const KINGS = {
  humano: { name: 'Rey Aldric', period: 5, text: '+4 ladrillos, +4 armas y +4 cristales' },
  enano:  { name: 'Rey Thorgrim', period: 4, text: 'Muro +12 y castillo +3; si tu muro ya tiene 40 o más, castillo +8 en su lugar' },
  elfo:   { name: 'Rey Aelwyn', period: 5, text: 'Cristales +6 y levantás 1 carta extra que no se repone al jugarla (los elfos pueden juntar hasta 8)' },
  drow:   { name: 'Reina Vaelith', period: 5, text: 'Rival: −6 de cada recurso y −3 de favor' },
  gnomo:  { name: 'Rey Fizzwick', period: 5, text: 'El Inventor: crea una máquina gnoma al azar y la juega gratis en el acto' },
  orco:   { name: 'Rey Gorrak', period: 5, text: 'Daño 12' },
};
// Cartas neutrales que apuntan al rey (122-129)
export const KING_CARDS = {
  122: ['Flecha envenenada', 'El rey rival queda desmayado 2 turnos', c(0, 9), Z, Z, { k: 'stunKing', turns: 2 }],
  123: ['Asesino real', 'El rey rival queda desmayado 3 turnos y pierde 2 de carga', c(0, 14), Z, Z, { k: 'stunKing', turns: 3, drain: 2 }],
  124: ['Sabotaje a la corte', 'El rey rival pierde toda su carga', c(0, 0, 10), Z, Z, { k: 'drainKing', all: true }],
  125: ['Guardia real', 'El próximo ataque a tu rey falla', c(6), Z, Z, { k: 'guardKing' }],
  126: ['Médico de la corte', 'Despierta a tu rey y le da +1 de carga', c(0, 0, 5), Z, Z, { k: 'wakeKing', charge: 1 }],
  127: ['Asalto al balcón', 'Daño 12 y el rey rival desmayado 2 turnos', c(0, 16), Z, o({ dmg: 12 }), { k: 'stunKing', turns: 2 }],
  128: ['Rayo cortesano', 'Daño 14 y el rey rival pierde 3 de carga', c(0, 0, 18), Z, o({ dmg: 14 }), { k: 'drainKing', drain: 3 }],
  129: ['Carga real', 'Tu rey gana 2 de carga', c(8), Z, Z, { k: 'chargeKing', charge: 2 }],
};
// Recurso de raza ("favor"): se gana 1 por turno propio (tope 10). Costo en el índice 8 del vector de costo.
const cf = (f, b = 0, w = 0, cr = 0) => [0, b, 0, w, 0, cr, 0, 0, f];
export const FAVOR_CARDS = {
  130: ['Mercenarios de oro', 'Soldados +1 y constructores +1', cf(3), s({ so: 1, bu: 1 }), Z],
  131: ['Tesoro real', 'Castillo +14', cf(5, 6), s({ castle: 14 }), Z],
  132: ['Soborno', 'Rival −1 soldado, vos +1 soldado', cf(4, 0, 0, 6), s({ so: 1 }), o({ so: 1 })],
  133: ['Runa de piedra', 'Muro +12', cf(3), s({ wall: 12 }), Z],
  134: ['Martillo rúnico', 'Daño 14 y muro +4', cf(4, 0, 8), s({ wall: 4 }), o({ dmg: 14 })],
  135: ['Forja rúnica', 'Castillo +10 y constructores +1', cf(5, 6), s({ castle: 10, bu: 1 }), Z],
  136: ['Savia vital', 'Castillo +5', cf(3), s({ castle: 5 }), Z],
  137: ['Flecha de savia', 'Daño 12 y rival −2 armas', cf(4, 0, 6), Z, o({ dmg: 12, w: 2 })],
  138: ['Despertar', 'Magos +1 y cristales +6', cf(5, 0, 0, 6), s({ ma: 1, cr: 6 }), Z],
  139: ['Velo de sombras', 'Escudo y cristales +4', cf(5), s({ cr: 4 }), Z, { k: 'shield' }],
  140: ['Puñal sombrío', 'Rival −1 constructor y daño 10', cf(4, 0, 7), Z, o({ bu: 1, dmg: 10 })],
  141: ['Ritual oscuro', 'Rival −8 de cada recurso y daño 8', cf(5, 0, 0, 8), Z, o({ b: 8, w: 8, cr: 8, dmg: 8 })],
  142: ['Ajuste fino', 'Armas +8', cf(3), s({ w: 8 }), Z],
  143: ['Bombarda', 'Daño 16', cf(4, 0, 9), Z, o({ dmg: 16 })],
  144: ['Autómata mayor', 'Soldados +1, constructores +1 y muro +4', cf(5, 8), s({ so: 1, bu: 1, wall: 4 }), Z],
  145: ['Rabia', 'Daño 8', cf(3), Z, o({ dmg: 8 })],
  146: ['Sacrificio', 'Soldados +2, tu muro −3', cf(4, 0, 5), s({ so: 2, wall: -3 }), Z],
  147: ['Ira del clan', 'Daño 18', cf(5, 0, 8), Z, o({ dmg: 18 })],
};
// Trampas (saltan en el turno rival), efectos duraderos (actúan al inicio de tus turnos), condicionales y cartas de rey (148-179)
export const TACTIC_CARDS = {
  148: ['Foso', 'Trampa: la próxima carga enemiga pierde la mitad del daño', c(8), Z, Z, { k: 'trap', t: 'moat' }],
  149: ['Contrahechizo', 'Trampa: anula el próximo hechizo rival que te afecte (daño, quitarte algo o tu rey) y te da 5 cristales', c(0, 0, 10), Z, Z, { k: 'trap', t: 'counterspell' }],
  150: ['Emboscada en el camino', 'Trampa: si el rival juega una carta de armas, recibe 6 de daño', c(0, 9), Z, Z, { k: 'trap', t: 'ambush' }],
  151: ['Red de espías', 'Trampa: cuando el rival juegue una carta que cueste 10 o más, ganás 8 cristales y ves su mano al empezar tu turno', c(0, 0, 6), Z, Z, { k: 'trap', t: 'spynet' }],
  152: ['Lluvia de piedras', '3 turnos: 5 de daño al rival al inicio de cada turno tuyo', c(0, 14), Z, Z, { k: 'effect', e: 'rain', turns: 3 }],
  153: ['Cantera activa', '3 turnos: +4 ladrillos al inicio de cada turno tuyo', c(10), Z, Z, { k: 'effect', e: 'quarry', turns: 3 }],
  154: ['Muro vivo', '3 turnos: muro +5 al inicio de cada turno tuyo', c(0, 0, 12), Z, Z, { k: 'effect', e: 'livingwall', turns: 3 }],
  155: ['Asedio prolongado', '3 turnos: las cartas del rival no le suben el muro', c(0, 13), Z, Z, { k: 'effect', e: 'siegelock', turns: 3, onOpp: true }],
  156: ['Diezmo real', '3 turnos: tu rey gana +1 de carga por turno', c(8), Z, Z, { k: 'effect', e: 'tithe', turns: 3 }],
  157: ['Golpe de gracia', 'Daño 10; 20 si el castillo rival tiene menos de 30', c(0, 14), Z, Z, { k: 'cond' }],
  158: ['Última defensa', 'Muro +6; +18 más si tu castillo tiene menos de 25', c(6), Z, Z, { k: 'cond' }],
  159: ['Superioridad', 'Daño 8; el doble si tenés más soldados que el rival', c(0, 10), Z, Z, { k: 'cond' }],
  160: ['Erudición', 'Cristales +6; magos +1 si tenés 5 o más magos', c(0, 0, 8), Z, Z, { k: 'cond' }],
  161: ['Reconstrucción', 'Castillo +8; +8 más si tu muro está en 0', c(9), Z, Z, { k: 'cond' }],
  162: ['Venganza', 'Daño igual al que recibiste en el último turno rival (hasta 20)', c(0, 9), Z, Z, { k: 'cond' }],
  163: ['Usurpación', 'Robás 2 de carga al rey rival y se la das al tuyo', c(0, 0, 15), Z, Z, { k: 'usurp' }],
  164: ['Ahora, mi rey', 'Tu rey actúa de inmediato y vuelve a cero', c(12, 0, 6), Z, Z, { k: 'kingNow' }],
  165: ['Doble corona', 'La próxima vez que actúe tu rey, lo hace dos veces', c(0, 0, 20), Z, Z, { k: 'kingDouble' }],
  166: ['Consejo de guerra', 'Tu rey +1 de carga y daño 6', c(0, 10), Z, o({ dmg: 6 }), { k: 'chargeKing', charge: 1 }],
  167: ['Luto', 'Mientras el rey rival esté desmayado, sus cartas cuestan 2 más', c(0, 0, 8), Z, Z, { k: 'luto' }],
  168: ['Milicia de reserva', 'Trampa: si te atacan, +1 soldado', c(5), Z, Z, { k: 'trap', t: 'militia' }],
  169: ['Edicto de obras', '4 turnos: +1 constructor cada 2 turnos', cf(3, 3), Z, Z, { k: 'effect', e: 'edict', turns: 4 }],
  170: ['Puerta de hierro', 'Trampa: anula el próximo daño directo al castillo', c(7), Z, Z, { k: 'trap', t: 'irongate' }],
  171: ['Minas profundas', '3 turnos: +3 ladrillos y muro +1 por turno', cf(3, 4), Z, Z, { k: 'effect', e: 'mines', turns: 3 }],
  172: ['Espejismo', 'Trampa: la próxima lluvia de flechas vuelve contra el rival', c(0, 0, 8), Z, Z, { k: 'trap', t: 'mirage' }],
  173: ['Canto antiguo', 'Cristales +5; +12 en vez de +5 si cambiaste una carta este turno', c(0, 0, 5), Z, Z, { k: 'cond' }],
  174: ['Pacto de sangre', 'Daño 8; 16 si el rey rival está desmayado', cf(2, 0, 6), Z, Z, { k: 'cond' }],
  175: ['Susurros', '3 turnos: el rival pierde 3 cristales y vos ganás 1 al inicio de cada turno tuyo', c(0, 0, 8), Z, Z, { k: 'effect', e: 'whispers', turns: 3 }],
  176: ['Mina terrestre', 'Trampa: la próxima carga enemiga explota: 10 de daño al atacante', cf(2, 0, 6), Z, Z, { k: 'trap', t: 'landmine' }],
  177: ['Taller nocturno', '3 turnos: +3 armas al inicio de cada turno tuyo', c(6), Z, Z, { k: 'effect', e: 'nightshop', turns: 3 }],
  178: ['Frenesí', 'Daño 12; 18 si tu muro está por debajo de 10', c(0, 9), Z, Z, { k: 'cond' }],
  179: ['Tambores de guerra', '3 turnos: tus ataques hacen +4', cf(3, 5), Z, Z, { k: 'effect', e: 'drums', turns: 3 }],
};
// grupos usados por reglas (trampas) y por las animaciones
export const ARROW_IDS = new Set([2, 6, 8, 83, 84, 90, 137]);
export const MELEE_IDS = new Set([1, 4, 7, 39, 47, 112, 114, 115, 117, 99, 93, 76, 53, 121, 178]);
