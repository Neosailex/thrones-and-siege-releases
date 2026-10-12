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
