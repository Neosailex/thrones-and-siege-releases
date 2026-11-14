// Rivales fantasma y bots (S08, 14/11; pedido de Juan "que el PvP funcione aunque haya pocos jugadores").
// - Cada partida online con ranking que termina guarda el FANTASMA de cada jugador: nombre, raza, mazo + As, rating y la
//   versión de reglas (huella del motor). Uno por jugador: el último.
// - Si no hay rival de verdad, se juega contra un fantasma de tu nivel manejado por la IA del motor (sala normal, el
//   lugar del rival lo juega el servidor). Siempre se ve como "Fantasma de <nombre>": nunca se hace pasar por una persona.
// - Sin fantasma posible: un BOT ("CPU entrenada") con un mazo oficial.
// - Antiabuso: fantasmas de los últimos 30 días, con las reglas actuales y mazo válido; no te toca el tuyo; no más de 2
//   veces seguidas el mismo. Al dueño solo le SUMA (tope por partida y por día), nunca le resta.
import * as DB from './db.mjs';
import { ENG } from './version.mjs';
import { validateDeck, padDeck, STYLE_DECKS, RACES } from '../shared/cards.js';

export const GHOST_DAYS = 30, OWNER_BONUS = 2, OWNER_DAY_MAX = 10;
const DAY = 864e5;
let S = null;
const st = () => {
  if (S) return S; const db = DB.rawDb(); if (!db) return null;
  return (S = {
    put: db.prepare(`INSERT INTO ghosts (player, name, race, deck, sleeve, rating, eng, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(player) DO UPDATE SET name = excluded.name, race = excluded.race, deck = excluded.deck, sleeve = excluded.sleeve, rating = excluded.rating, eng = excluded.eng, created = excluded.created`),
    near: db.prepare(`SELECT g.* FROM ghosts g JOIN players p ON p.id = g.player WHERE g.eng = ? AND g.created > ? AND g.player != ? AND p.hidden = 0
      ORDER BY ABS(g.rating - ?) LIMIT 12`),
    log: db.prepare('INSERT INTO ghost_log (owner, rival, won, bonus, ts) VALUES (?, ?, ?, ?, ?)'),
    today: db.prepare('SELECT COALESCE(SUM(bonus), 0) AS n FROM ghost_log WHERE owner = ? AND ts > ?'),
    unseen: db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(won), 0) AS won, COALESCE(SUM(bonus), 0) AS bonus FROM ghost_log WHERE owner = ? AND seen = 0'),
    seen: db.prepare('UPDATE ghost_log SET seen = 1 WHERE owner = ? AND seen = 0'),
    stat: db.prepare('INSERT INTO match_stats (ts, kind, wait_ms) VALUES (?, ?, ?)'),
    statSum: db.prepare('SELECT kind, COUNT(*) AS n, AVG(wait_ms) AS avg FROM match_stats WHERE ts > ? GROUP BY kind'),
    waits: db.prepare("SELECT wait_ms FROM match_stats WHERE ts > ? AND kind = 'persona' ORDER BY wait_ms"),
    clean: db.prepare('DELETE FROM match_stats WHERE ts < ?'),
    botWins: db.prepare("SELECT winner FROM matches WHERE a = ? AND kind = 'bot' ORDER BY ts DESC LIMIT 10"),
  });
};

// Al terminar una partida con ranking: guardar el fantasma de cada jugador (si jugó con un mazo válido)
export function saveGhosts(seats) {
  if (!st()) return;
  for (const x of seats) {
    if (!x?.pid || x.ai || !x.race || validateDeck(x.deck, x.race)) continue;
    const p = DB.profile(x.pid); if (!p) continue;
    st().put.run(x.pid, x.name || '', x.race, JSON.stringify(x.deck), x.sleeve ?? null, p.rating, ENG, Date.now());
  }
}

// Últimos dueños de fantasma que le tocaron a cada jugador (en memoria: alcanza para "no más de 2 veces seguidas")
const LAST = new Map();
// Elegir un fantasma para este jugador: el más cercano en rating (entre los 5 más cercanos, al azar)
export function pickGhost(pid, rating) {
  if (!st()) return null;
  const last = LAST.get(pid) || [];
  const banned = last.length >= 2 && last[0] === last[1] ? last[0] : null;
  const list = st().near.all(ENG, Date.now() - GHOST_DAYS * DAY, pid, rating).filter((g) => g.player !== banned).filter((g) => { try { return !validateDeck(JSON.parse(g.deck), g.race); } catch { return false; } });
  if (!list.length) return null;
  const g = list[Math.floor(Math.random() * Math.min(5, list.length))];
  LAST.set(pid, [g.player, ...last].slice(0, 2));
  return { owner: g.player, name: g.name, race: g.race, deck: padDeck(JSON.parse(g.deck)), sleeve: g.sleeve, rating: g.rating };
}

// ---- Bots de rangos bajos, estilo Marvel Snap (14/11, tanda b) ----
// Solo para los que recién empiezan: menos de BOT_PARTIDAS partidas o rating < BOT_HASTA. Cuanto más subís, más tarde
// aparece (más tiempo para encontrar a una persona); desde ahí, solo personas o fantasmas.
// La torpeza (cada tanto juega una carta cualquiera) se ajusta sola para que el jugador le gane ~60 % (últimas 10 contra bots).
// Simulación (Fácil vs Fácil con mazos oficiales, 300 partidas): torpeza 0 → 52 %, 0,15 → 59 %, 0,3 → 63 %.
export const BOT_PARTIDAS = 20, BOT_HASTA = 1050, BOT_META = 0.6;
export function botDelayMs(p) {
  if (!p || process.env.BOTS === '0') return null;
  if (p.games < 10) return 5000;
  if (p.games < BOT_PARTIDAS) return 8000;
  if (p.rating < BOT_HASTA) return 12000;
  return null;
}
export function botTorpeza(pid) {
  const rows = st()?.botWins.all(pid) || [];
  if (rows.length < 3) return 0.15;
  const wr = rows.reduce((a, r) => a + (r.winner === 0 ? 1 : 0), 0) / rows.length; // en la tabla, a = el jugador: winner 0 = ganó
  return Math.max(0, Math.min(0.45, 0.15 + (BOT_META - wr)));
}
// Bot "CPU entrenada": juega con el mazo de un jugador real de ese nivel (sin su nombre); si no hay, uno oficial
export function makeBot(rating, pid = null) {
  let deck = null, race = null;
  if (st()) {
    const list = st().near.all(ENG, Date.now() - GHOST_DAYS * DAY, pid || '', rating).filter((g) => { try { return !validateDeck(JSON.parse(g.deck), g.race); } catch { return false; } });
    const g = list[Math.floor(Math.random() * Math.min(8, list.length))];
    if (g) { deck = padDeck(JSON.parse(g.deck)); race = g.race; }
  }
  if (!deck) {
    const races = Object.keys(STYLE_DECKS).filter((r) => RACES[r]);
    race = races[Math.floor(Math.random() * races.length)];
    const styles = Object.keys(STYLE_DECKS[race]), style = styles[Math.floor(Math.random() * styles.length)];
    deck = padDeck(STYLE_DECKS[race][style].deck);
  }
  return { owner: null, name: '', race, deck, sleeve: null, rating: Math.max(800, rating - 50) };
}

// Nivel de la IA según el rating del fantasma/bot
export const aiLevel = (rating) => (rating < 1050 ? 'facil' : rating < 1250 ? 'normal' : 'dificil');

// Si el fantasma ganó: el dueño suma un poco (tope por día). Siempre queda anotado para avisarle.
export function ownerResult(owner, rival, ghostWon) {
  if (!st() || !owner) return 0;
  const used = st().today.get(owner, Date.now() - DAY).n;
  const bonus = ghostWon ? Math.max(0, Math.min(OWNER_BONUS, OWNER_DAY_MAX - used)) : 0;
  if (bonus) DB.addRating(owner, bonus);
  st().log.run(owner, rival, ghostWon ? 1 : 0, bonus, Date.now());
  return bonus;
}
// Aviso al dueño cuando entra: lo que hizo su fantasma desde la última vez (y se marca como visto)
export function ghostNews(owner) {
  if (!st()) return null;
  const r = st().unseen.get(owner); if (!r.n) return null;
  st().seen.run(owner);
  return { played: r.n, won: r.won, bonus: r.bonus };
}

// ---- para medir ----
export function stat(kind, waitMs) { try { st()?.stat.run(Date.now(), kind, Math.max(0, Math.min(36e5, Math.round(waitMs || 0)))); } catch {} }
export function statsSummary() {
  if (!st()) return null;
  const out = {};
  for (const [k, ms] of [['24h', DAY], ['7d', 7 * DAY]]) {
    const since = Date.now() - ms, by = Object.fromEntries(st().statSum.all(since).map((r) => [r.kind, { partidas: r.n, esperaMedia: Math.round(r.avg / 100) / 10 }]));
    const w = st().waits.all(since).map((r) => r.wait_ms), med = w.length ? Math.round(w[Math.floor(w.length / 2)] / 100) / 10 : null;
    out[k] = { persona: by.persona?.partidas || 0, fantasma: by.fantasma?.partidas || 0, bot: by.bot?.partidas || 0,
      esperaPersonaMediana: med, esperaFantasmaMedia: by.fantasma?.esperaMedia ?? null, esperaBotMedia: by.bot?.esperaMedia ?? null };
  }
  st().clean.run(Date.now() - 90 * DAY);
  return out;
}
