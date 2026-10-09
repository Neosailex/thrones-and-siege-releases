// Persistencia: un solo archivo SQLite (node:sqlite, sin instalar nada). Jugadores, ranking ELO y estadísticas.
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

let DatabaseSync = null; try { ({ DatabaseSync } = await import('node:sqlite')); } catch {}
const FILE = process.env.DB_FILE || path.resolve('data/asedio.db');
let db = null;
if (DatabaseSync) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); db = new DatabaseSync(FILE); }
// Sin SQLite (app de escritorio hosteando): memoria, se pierde al cerrar
const MEM = { players: new Map(), matches: [] };
if (!db) {
  const now0 = () => Date.now(), hash0 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
  const kf = (p) => (p.games < 10 ? 40 : p.rating >= 1600 ? 20 : 30);
  const memAuth = (id, token, name) => { if (typeof id !== 'string' || typeof token !== 'string' || id.length < 8) return null; let p = MEM.players.get(id); if (!p) { p = { id, token_hash: hash0(token), name, rating: 1000, peak: 1000, games: 0, wins: 0, losses: 0, abandons: 0, streak: 0, best_streak: 0, fastest_win: null, created: now0(), updated: now0(), cards: {} }; MEM.players.set(id, p); } if (p.token_hash !== hash0(token)) return null; if (name) p.name = name; return p; };
  const memRecord = ({ ids, winner, reason, turns, plays }) => { const [a, b] = ids.map((id) => MEM.players.get(id)); if (!a || !b) return null; const ea = 1 / (1 + 10 ** ((b.rating - a.rating) / 400)), sa = winner === 0 ? 1 : 0; const da = Math.round(kf(a) * (sa - ea)), dbb = Math.round(kf(b) * ((1 - sa) - (1 - ea))); const res = []; for (const [i, p, d] of [[0, a, da], [1, b, dbb]]) { const won = winner === i ? 1 : 0, r = Math.max(100, p.rating + d); res.push({ before: p.rating, after: r }); p.rating = r; p.peak = Math.max(p.peak, r); p.games++; p.wins += won; p.losses += 1 - won; if (reason === 'abandon' && !won) p.abandons++; p.streak = won ? Math.max(0, p.streak) + 1 : 0; p.best_streak = Math.max(p.best_streak, p.streak); if (won && (p.fastest_win == null || p.fastest_win > turns)) p.fastest_win = turns; for (const [c, n] of Object.entries(plays[i] || {})) p.cards[c] = (p.cards[c] || 0) + n; } MEM.matches.push({ a: a.id, b: b.id, winner }); return res; };
  const memTop = (limit) => [...MEM.players.values()].filter((p) => p.games > 0).sort((x, y) => y.rating - x.rating || y.wins - x.wins).slice(0, limit).map((p, i) => ({ pos: i + 1, id: p.id.slice(0, 6), name: p.name, rating: p.rating, games: p.games, wins: p.wins }));
  const memProfile = (id) => { const p = MEM.players.get(String(id)); if (!p) return null; const rank = p.games ? [...MEM.players.values()].filter((x) => x.games > 0 && x.rating > p.rating).length + 1 : null; return { name: p.name, rating: p.rating, peak: p.peak, games: p.games, wins: p.wins, losses: p.losses, abandons: p.abandons, streak: p.streak, bestStreak: p.best_streak, fastestWin: p.fastest_win, rank, favorites: Object.entries(p.cards).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([card, n]) => ({ card: +card, n })) }; };
  var MEMAPI = { auth: memAuth, recordMatch: memRecord, leaderboard: memTop, profile: memProfile, ratingOf: (id) => MEM.players.get(id)?.rating ?? 1000 };
}
if (db) db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1000, peak INTEGER NOT NULL DEFAULT 1000,
    games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
    abandons INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0,
    fastest_win INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS card_plays (player TEXT NOT NULL, card INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (player, card));
  CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT, b TEXT, winner INTEGER, reason TEXT, turns INTEGER, ra INTEGER, rb INTEGER, delta INTEGER, ts INTEGER);
`);

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const now = () => Date.now();
const q = !db ? null : {
  get: db.prepare('SELECT * FROM players WHERE id = ?'),
  ins: db.prepare('INSERT INTO players (id, token_hash, name, created, updated) VALUES (?, ?, ?, ?, ?)'),
  name: db.prepare('UPDATE players SET name = ?, updated = ? WHERE id = ?'),
  top: db.prepare('SELECT id, name, rating, games, wins FROM players WHERE games > 0 ORDER BY rating DESC, wins DESC LIMIT ?'),
  rank: db.prepare('SELECT COUNT(*) AS n FROM players WHERE games > 0 AND rating > ?'),
  cards: db.prepare('SELECT card, n FROM card_plays WHERE player = ? ORDER BY n DESC LIMIT 3'),
  addCard: db.prepare('INSERT INTO card_plays (player, card, n) VALUES (?, ?, ?) ON CONFLICT(player, card) DO UPDATE SET n = n + excluded.n'),
  upd: db.prepare(`UPDATE players SET rating = ?, peak = MAX(peak, ?), games = games + 1, wins = wins + ?, losses = losses + ?, abandons = abandons + ?,
    streak = ?, best_streak = MAX(best_streak, ?), fastest_win = CASE WHEN ? = 1 AND (fastest_win IS NULL OR fastest_win > ?) THEN ? ELSE fastest_win END, updated = ? WHERE id = ?`),
  match: db.prepare('INSERT INTO matches (a, b, winner, reason, turns, ra, rb, delta, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
};

// Identidad de invitado: el cliente genera id + token y los guarda. Más adelante se reemplaza por la cuenta de Steam.
export function auth(id, token, name) {
  if (!db) return MEMAPI.auth(id, token, name);
  if (typeof id !== 'string' || typeof token !== 'string' || id.length < 8 || id.length > 64 || token.length < 16) return null;
  const p = q.get.get(id);
  if (!p) { q.ins.run(id, hash(token), name, now(), now()); return q.get.get(id); }
  if (p.token_hash !== hash(token)) return null;
  if (name && name !== p.name) q.name.run(name, now(), id);
  return q.get.get(id);
}

const kFactor = (p) => (p.games < 10 ? 40 : p.rating >= 1600 ? 20 : 30);

// Registra el resultado y devuelve [{before, after}] por asiento.
export function recordMatch({ ids, winner, reason, turns, plays }) {
  if (!db) return MEMAPI.recordMatch({ ids, winner, reason, turns, plays });
  const [a, b] = ids.map((id) => q.get.get(id));
  if (!a || !b) return null;
  const ea = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
  const sa = winner === 0 ? 1 : 0;
  const da = Math.round(kFactor(a) * (sa - ea)), db2 = Math.round(kFactor(b) * ((1 - sa) - (1 - ea)));
  const res = [];
  db.exec('BEGIN');
  try {
    for (const [i, p, d] of [[0, a, da], [1, b, db2]]) {
      const won = winner === i ? 1 : 0, r = Math.max(100, p.rating + d);
      const streak = won ? Math.max(0, p.streak) + 1 : 0;
      const abandoned = reason === 'abandon' && !won ? 1 : 0;
      q.upd.run(r, r, won, 1 - won, abandoned, streak, streak, won, turns, turns, now(), p.id);
      for (const [card, n] of Object.entries(plays[i] || {})) q.addCard.run(p.id, Number(card), n);
      res.push({ before: p.rating, after: r });
    }
    q.match.run(a.id, b.id, winner, reason, turns, a.rating, b.rating, da, now());
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return res;
}

export const leaderboard = (limit = 20) => !db ? MEMAPI.leaderboard(limit) : q.top.all(limit).map((p, i) => ({ pos: i + 1, id: p.id.slice(0, 6), name: p.name, rating: p.rating, games: p.games, wins: p.wins }));

export function profile(id) {
  if (!db) return MEMAPI.profile(id);
  const p = q.get.get(String(id)); if (!p) return null;
  return {
    name: p.name, rating: p.rating, peak: p.peak, games: p.games, wins: p.wins, losses: p.losses, abandons: p.abandons,
    streak: p.streak, bestStreak: p.best_streak, fastestWin: p.fastest_win, rank: p.games ? q.rank.get(p.rating).n + 1 : null,
    favorites: q.cards.all(p.id).map((c) => ({ card: c.card, n: c.n })),
  };
}
export const ratingOf = (id) => (!db ? MEMAPI.ratingOf(id) : q.get.get(id)?.rating ?? 1000);
