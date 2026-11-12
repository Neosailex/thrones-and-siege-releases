// Códigos en vez de frases (S08, 11/11; plan de idiomas docs/idiomas/plan.md). El servidor no manda texto para leer:
// manda un código (y datos) y cada cliente lo muestra en su idioma. Lista completa con los textos de referencia:
// docs/idiomas/codigos-servidor.md (la mantienen S08 + S06; S01 los pasa a shared/i18n/<idioma>.js).
import { NCARDS, DECK_SIZE, maxCopies, raceOf, padDeck } from '../shared/cards.js';

// Error al entrar a una sala: el mensaje es "código|LEGADO" (LEGADO = lo que buscaban los clientes viejos, p. ej. VERSION)
export const joinError = (code, legacy = '') => new Error(legacy ? `${code}|${legacy}` : code);

// Problema de un mazo, como código + datos (misma regla que validateDeck de shared/cards.js, que devuelve frases para el editor)
export function deckProblem(d, race = null) {
  if (!Array.isArray(d) || d.length < 179 || d.length > NCARDS || d.some((n) => !Number.isInteger(n) || n < 0)) return { code: 'deck.invalid' };
  d = padDeck(d);
  for (let i = 0; i < NCARDS; i++) {
    if (d[i] > maxCopies(i + 1)) return { code: 'deck.tooMany', params: { id: i + 1, max: maxCopies(i + 1) } };
    const r = raceOf(i + 1); if (d[i] > 0 && r && r !== race) return { code: 'deck.wrongRace', params: { id: i + 1, race: r } };
  }
  const t = d.reduce((a, b) => a + b, 0); if (t !== DECK_SIZE) return { code: 'deck.size', params: { n: t, need: DECK_SIZE } };
  return null;
}

// Errores de la API (JSON { error }): se agrega { err: código } sin sacar el error viejo (los clientes viejos lo usan)
export const API_ERR = {
  'sin base': 'net.noDb', red: 'net.offline', identidad: 'auth.identity',
  // reportes
  jugador: 'player.notFound', vos: 'report.self', motivo: 'report.reason', 'jugá primero': 'report.notPlayed', 'límite': 'report.limit',
  // desafío diario
  'ya jugaste': 'daily.alreadyPlayed', intento: 'daily.attempt', tarde: 'daily.late', reino: 'daily.kingdom', piso: 'daily.floor',
  turnos: 'daily.turns', castillo: 'daily.castle', 'muy rápido': 'daily.tooFast',
  // nube y vincular
  parte: 'cloud.part', 'muy grande': 'cloud.tooBig', 'código': 'link.code', vencido: 'link.expired', demasiados: 'link.tooMany',
  // cuentas
  apagado: 'account.off', token: 'account.token', 'otra cuenta': 'account.other', 'sesión': 'account.session', 'confirmación': 'account.confirm',
  // revisión
  'acción': 'admin.action',
};
export function apiCodes(_q, r, next) {
  const json = r.json.bind(r);
  r.json = (b) => json(b && typeof b === 'object' && !Array.isArray(b) && b.error && !b.err ? { ...b, err: API_ERR[b.error] || 'error.unknown' } : b);
  next();
}
