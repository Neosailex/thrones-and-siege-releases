// Tipo de golpe (Juan 20/10, para S04): cómo se ve cada daño al muro/castillo. Solo datos visuales, no cambian reglas.
// arma:   'piedra' | 'asalto' | 'magia' | 'fuego' | 'flechas' | 'rayo' | 'explosion' (agregado por S03: pólvora gnoma, minas, bombardas)
// altura: 'alto' | 'medio' | 'base'   (dónde pega en el muro/castillo)
// color:  solo para magia: el color de la raza de quien la lanza (MAGIC_COLORS); las cartas de raza fijan el suyo.
// Lo usa engine.js para completar cada golpe de daño (ev.golpes[].arma/altura/color). Ver docs/arte/animacion-y-sonido.md.
export const ARMAS = ['piedra', 'asalto', 'magia', 'fuego', 'flechas', 'rayo', 'explosion'];
export const ALTURAS = ['alto', 'medio', 'base'];
// color de la magia por raza (rey/mago). humano y elfo salen de los destellos que ya usa el juego; el resto, de sus reyes.
export const MAGIC_COLORS = { humano: '#ffd36a', enano: '#7fc8ff', elfo: '#9df0a0', drow: '#b07cff', gnomo: '#ffb347', orco: '#ff5a3c', neutral: '#c9b8ff' };
const h = (arma, altura, race) => ({ arma, altura, ...(race ? { race } : {}) });
// por id de carta (1-185 y campaña 190+). race = raza fija del color (cartas de raza); si no, el color sale de quien la juega.
export const HITS = {
  // originales y neutrales
  1: h('piedra', 'medio'), 2: h('flechas', 'alto'), 3: h('piedra', 'alto'), 4: h('asalto', 'base'), 6: h('flechas', 'medio'), 7: h('asalto', 'base'), 8: h('flechas', 'alto'),
  16: h('rayo', 'alto'), 17: h('rayo', 'alto'), 37: h('piedra', 'alto'), 38: h('piedra', 'medio'), 39: h('asalto', 'base'), 46: h('fuego', 'alto'), 47: h('asalto', 'medio'),
  48: h('asalto', 'medio'), 49: h('magia', 'medio'), 50: h('asalto', 'alto'), 56: h('rayo', 'alto'), 60: h('asalto', 'medio'),
  // de raza
  76: h('asalto', 'base'), 83: h('flechas', 'alto'), 84: h('flechas', 'alto'), 88: h('magia', 'medio', 'elfo'), 90: h('flechas', 'alto'),
  93: h('asalto', 'medio'), 99: h('asalto', 'medio'), 100: h('magia', 'base', 'drow'),
  103: h('flechas', 'medio'), 107: h('piedra', 'alto'), 108: h('explosion', 'alto'), 110: h('piedra', 'alto'), 111: h('explosion', 'alto'),
  112: h('asalto', 'medio'), 114: h('asalto', 'medio'), 115: h('asalto', 'base'), 117: h('asalto', 'base'), 118: h('magia', 'medio', 'orco'), 120: h('asalto', 'medio'), 121: h('asalto', 'base'),
  // de rey, favor y tácticas
  127: h('asalto', 'alto'), 128: h('rayo', 'alto'), 134: h('magia', 'medio', 'enano'), 137: h('flechas', 'alto'), 140: h('asalto', 'medio'), 141: h('magia', 'medio', 'drow'),
  143: h('explosion', 'medio'), 145: h('asalto', 'medio'), 147: h('asalto', 'medio'),
  152: h('piedra', 'alto'), 157: h('asalto', 'medio'), 159: h('asalto', 'medio'), 162: h('asalto', 'medio'), 166: h('asalto', 'medio'),
  174: h('magia', 'medio', 'drow'), 178: h('asalto', 'medio'),
  // míticas: el Ataque del rey de cada uno
  180: h('asalto', 'medio'), 181: h('asalto', 'alto'), 182: h('flechas', 'alto'), 183: h('magia', 'medio', 'drow'), 184: h('explosion', 'medio'), 185: h('asalto', 'medio'),
  // campaña (cartas de bicho)
  196: h('fuego', 'medio'), 197: h('flechas', 'alto'), 198: h('asalto', 'medio'),
  // campaña estilo StS (25/10, 210-284; la versión + usa el de su carta base; las Obras pegan con el de su carta: origen 'obra:<id>')
  210: h('asalto', 'medio'), 218: h('asalto', 'medio'), 220: h('piedra', 'medio'), 224: h('piedra', 'alto'), 225: h('piedra', 'base'), 228: h('piedra', 'alto'),
  231: h('asalto', 'medio'), 232: h('asalto', 'medio'), 234: h('asalto', 'medio'), 237: h('asalto', 'medio'), 239: h('asalto', 'base'),
  240: h('magia', 'medio', 'elfo'), 243: h('flechas', 'alto'), 246: h('flechas', 'alto'), 249: h('magia', 'alto', 'elfo'),
  250: h('explosion', 'medio'), 254: h('flechas', 'medio'), 255: h('explosion', 'medio'), 257: h('explosion', 'alto'),
  261: h('asalto', 'medio'), 262: h('magia', 'medio', 'drow'), 266: h('asalto', 'medio'), 269: h('magia', 'alto', 'drow'),
  270: h('asalto', 'medio'), 272: h('asalto', 'medio'), 276: h('asalto', 'medio'), 278: h('piedra', 'alto'), 281: h('asalto', 'medio'),
};
// por nombre de efecto, trampa o rey (el `origen` de los golpes que no son una carta jugada)
export const HIT_FX = {
  rain: h('piedra', 'alto'),            // Lluvia de piedras (152), al empezar el turno
  ambush: h('flechas', 'medio'),        // Emboscada en el camino (150), le pega al que jugó armas
  landmine: h('explosion', 'base'),     // Mina terrestre (176), le explota al que cargó
  mirage: h('flechas', 'alto'),         // Espejismo (172): la flecha vuelve contra el que la tiró
  orco: h('asalto', 'medio'),           // acción del rey Gorrak: daño 12
  ash: h('magia', 'medio', 'drow'),     // Ceniza (Juan 27/10): lo que el piso le frena al drow quema el muro rival
  poison: h('magia', 'base', 'drow'),   // campaña: Susurro venenoso (pierde castillo por estados en la mano)
  regla: h('asalto', 'medio'),          // campaña: equipo que pega (Guantes de albañil)
};
// { arma, altura, color } para un golpe de daño; null si no hay tipo cargado (la auditoría lo marca)
export function hitOf(origen, casterRace) {
  if (typeof origen === 'number' && origen > 1000) origen -= 1000; // versión + de campaña
  if (typeof origen === 'string' && origen.startsWith('obra:')) origen = +origen.slice(5) % 1000; // Obra de campaña: pega como su carta
  const e = typeof origen === 'number' ? HITS[origen] : HIT_FX[origen]; if (!e) return null;
  return { arma: e.arma, altura: e.altura, color: e.arma === 'magia' ? MAGIC_COLORS[e.race || casterRace] || MAGIC_COLORS.neutral : null };
}
