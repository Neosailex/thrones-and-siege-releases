// Idiomas — parte compartida (S01, 11/11). Funciones puras, sin DOM ni Node: las usan el cliente y las herramientas
// (tools/i18n/faltantes.mjs, chequeo de números). La BASE de cartas, razas, reyes y mazos son los datos de siempre
// (NAMES, RACES, KINGS, STYLE_DECKS, CAMPAIGN_CARDS); los otros idiomas van por id en shared/i18n/<lang>.js.
// Un "diccionario" es { cards, camp, races, kings, decks, codes }; se buscan en una cadena: [idioma, padre, en] y,
// si nadie lo tiene, la base. Ver docs/idiomas/plan.md, "Estructura técnica".
import { NAMES, STYLE_DECKS } from '../cards.js';
import { RACES, KINGS } from '../races.js';
import { CAMPAIGN_CARDS, PLUS } from '../campaign-cards.js';
import BASE from './es.js';

// una entrada de carta puede ser [nombre, texto] o { name, text } (S03 acepta las dos)
const norm = (e) => (!e ? null : Array.isArray(e) ? e : [e.name ?? null, e.text ?? null]);
const first = (chain, get) => { for (const d of chain) { const v = d && get(d); if (v != null && v !== '') return v; } return null; };

// [nombre, texto] de una carta (PvP o campaña; la versión + es id + 1000: nombre base + "+" del idioma)
export function cardOf(id, chain = []) {
  const plus = id > PLUS, b = plus ? id - PLUS : id;
  const base = NAMES[b] || (CAMPAIGN_CARDS[b] ? [CAMPAIGN_CARDS[b][0], CAMPAIGN_CARDS[b][1]] : null);
  const loc = norm(first(chain, (d) => (plus ? d.camp?.[id] || d.cards?.[id] : null) || d.cards?.[b] || d.camp?.[b]));
  if (plus) {   // la + tiene su propio texto en la base de campaña; si el idioma no lo da, se usa el de la base
    const pb = NAMES[id] || (CAMPAIGN_CARDS[id] ? [CAMPAIGN_CARDS[id][0], CAMPAIGN_CARDS[id][1]] : null);
    const plusLoc = norm(first(chain, (d) => d.camp?.[id] || d.cards?.[id]));
    if (plusLoc) return [plusLoc[0], plusLoc[1] ?? pb?.[1] ?? base?.[1] ?? ''];
    if (pb) return [loc ? loc[0] + '+' : pb[0], pb[1]];
  }
  const n = loc?.[0] ?? base?.[0] ?? `#${id}`, t = loc?.[1] ?? base?.[1] ?? '';
  return [n, t];
}
// plantilla del idioma (texto con marcas {o6}…, S03) o null si el idioma no la tiene: para realOf(…, { tpl })
export function cardTplOf(id, chain = []) { const e = norm(first(chain, (d) => d.cards?.[id] || d.camp?.[id])); return e?.[1] ?? null; }
export const cardName = (id, chain) => cardOf(id, chain)[0];
export const cardText = (id, chain) => cardOf(id, chain)[1];

// raza: name (Humanos), passive, favor (Oro) + lo que agregue S06 (people, land…)
export const raceField = (race, field, chain = []) => first(chain, (d) => d.races?.[race]?.[field]) ?? RACES[race]?.[field] ?? '';
// rey: name (Rey Aldric), text (poder)
export const kingField = (race, field, chain = []) => first(chain, (d) => d.kings?.[race]?.[field]) ?? KINGS[race]?.[field] ?? '';
// mazo oficial: name, desc
export const deckField = (race, style, field, chain = []) => first(chain, (d) => d.decks?.[race]?.[style]?.[field]) ?? STYLE_DECKS[race]?.[style]?.[field] ?? '';
// códigos del servidor (S08): { err: 'deck.tooMany', … } → texto
export const codeText = (code, chain = []) => first(chain, (d) => d.codes?.[code]) ?? BASE.codes?.[code] ?? code;
