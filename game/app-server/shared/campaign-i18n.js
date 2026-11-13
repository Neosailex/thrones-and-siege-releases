// (S03 12/11) Textos de campaña traducibles: nombres y descripciones de enemigos y Heraldos, reglas (de enemigos, equipo y reliquias),
// intenciones del enemigo y avisos de reglas. Puro (sin DOM), lo usan shared/campaign.js, el cliente y las herramientas.
// La base es el castellano que ya está en los datos (shared/campaign.js); cada idioma trae `campData` en shared/i18n/<lang>.js:
//   campData: {
//     foes:    { 'lor-edmund-el-recaudador': 'Lord Edmund, the Tax Collector', … }   clave = foeKey(nombre castellano); valor: nombre o { name, desc }
//     heralds: { tesorero: { name: 'The Black Treasurer', desc: '…' }, … }               por id del Heraldo
//     rules:   { hoard: 'At the start of its turn it steals {amount} …', … }              por regla (r.k); string con {parámetro} o función (r) => texto
//     intents: { attack: 'Attacks {n}', 'hoard': 'Steals {n} {res}…', … }                 avisos de la intención; string con {variable} o función (vars) => texto
//     bugIntents: { 341: '…' }                                                             intención fija de las acciones de bicho (300-399), por id
//     words:   { brick: 'bricks', weapon: 'weapons', crystal: 'crystals' }                palabras sueltas que se meten en los textos
//   }
// La UI llama setCampLang(campData del idioma, { cardName }) al cambiar de idioma (con el respaldo ya resuelto: idioma → padre → en).
// Para ver todas las claves y el castellano base: node tools/i18n/campdata_base.mjs
let D = null, CARD_NAME = null, STR = null;
// opt.cardName(id) → nombre de carta en el idioma; opt.str(texto castellano) → su traducción (tabla `campaign` de S01)
export function setCampLang(campData = null, opt = {}) { D = campData || null; CARD_NAME = opt.cardName || null; STR = opt.str || null; }
export const campLang = () => D;
const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m));
// tr(sección, clave, variables, base): texto del idioma si existe, si no la base (string con {var} o función)
export function tr(section, key, vars, base) {
  let x = D?.[section]?.[key];
  if (x && typeof x === 'object') x = x[vars?.v];   // (S06 13/11) plantilla con variantes { variante: texto }: vars.v dice cuál (como RULES[k].tpl)
  if (x != null && x !== '') { try { return typeof x === 'function' ? x(vars || {}) : fill(x, vars); } catch { /* traducción rota: base */ } }
  return typeof base === 'function' ? base(vars || {}) : fill(base ?? key, vars);
}
// clave estable de un enemigo: su nombre castellano sin tildes, en minúscula y con guiones
export const foeKey = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const foeOf = (key) => { const x = D?.foes?.[key]; return typeof x === 'string' ? { name: x } : x || null; };
// nombre y descripción de un enemigo (o Heraldo, o secuaz) en el idioma actual
export function foeName(e) { if (!e) return ''; if (e.id && D?.heralds?.[e.id]?.name) return D.heralds[e.id].name; return foeOf(foeKey(e.name))?.name || e.name || ''; }
export function foeDesc(e) { if (!e) return ''; if (e.id && D?.heralds?.[e.id]?.desc) return D.heralds[e.id].desc; return foeOf(foeKey(e.name))?.desc || e.desc || ''; }
export const word = (k, base) => D?.words?.[k] || base;
export const cardNameI = (id, base) => (CARD_NAME ? CARD_NAME(id) || base : base);
export const strI = (s) => (STR ? STR(s) || s : s);
