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
  const memAuth = (id, token, name) => { if (typeof id !== 'string' || typeof token !== 'string' || id.length < 8) return null; let p = MEM.players.get(id); if (!p) { p = { id, pub: pubOf(id), token_hash: hash0(token), name, rating: 1000, peak: 1000, games: 0, wins: 0, losses: 0, abandons: 0, streak: 0, best_streak: 0, fastest_win: null, created: now0(), updated: now0(), cards: {} }; MEM.players.set(id, p); } if (p.token_hash !== hash0(token)) return null; if (name) p.name = name; return p; };
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
  -- temporadas (S08, 25/10): ELO propio por temporada (mes calendario UTC), con arranque suave desde el ELO histórico
  CREATE TABLE IF NOT EXISTS season_stats (season TEXT NOT NULL, player TEXT NOT NULL, rating INTEGER NOT NULL, peak INTEGER NOT NULL,
    games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, abandons INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (season, player));
  CREATE INDEX IF NOT EXISTS season_rank ON season_stats (season, rating DESC);
  -- reportes (S08, 25/10)
  CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, note TEXT, ts INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS reports_target ON reports (target, ts);
  -- desafío diario de campaña (S08, 25/10; lógica en diario.mjs)
  CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, player TEXT NOT NULL, token TEXT NOT NULL, started INTEGER NOT NULL, finished INTEGER,
    kingdom TEXT, floor INTEGER, won INTEGER, turns INTEGER, castle INTEGER, PRIMARY KEY (day, player));
  CREATE INDEX IF NOT EXISTS daily_rank ON daily (day, won DESC, floor DESC, castle DESC, turns ASC);
`);
// columnas nuevas en bases que ya existen (Fly): se agregan una sola vez
if (db) {
  const add = (table, col, def) => { if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); };
  add('players', 'pub', 'TEXT'); add('players', 'name_locked', 'INTEGER NOT NULL DEFAULT 0'); add('players', 'hidden', 'INTEGER NOT NULL DEFAULT 0');
  add('matches', 'season', 'TEXT'); add('matches', 'race_a', 'TEXT'); add('matches', 'race_b', 'TEXT');
  add('matches', 'sra', 'INTEGER'); add('matches', 'srb', 'INTEGER'); add('matches', 'sda', 'INTEGER'); add('matches', 'sdb', 'INTEGER');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS players_pub ON players (pub)');
  db.exec('CREATE INDEX IF NOT EXISTS matches_a ON matches (a, ts)'); db.exec('CREATE INDEX IF NOT EXISTS matches_b ON matches (b, ts)');
  const fill = db.prepare('UPDATE players SET pub = ? WHERE id = ?');
  for (const r of db.prepare('SELECT id FROM players WHERE pub IS NULL').all()) fill.run(pubOf(r.id), r.id);
}

const hash = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const now = () => Date.now();
// id público: no deja ver el id secreto del jugador (con el que se identifica) y sirve para ver perfiles de otros
export const rawDb = () => db; // para diario.mjs
export function pubOf(id) { return crypto.createHash('sha256').update('pub:' + id).digest('base64url').slice(0, 12); }

// ---- temporadas: una por mes calendario (UTC). id 'AAAA-MM' ----
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function seasonInfo(id = null) {
  const d = new Date(); const sid = id && /^\d{4}-\d{2}$/.test(id) ? id : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, m] = sid.split('-').map(Number);
  const start = Date.UTC(y, m - 1, 1), end = Date.UTC(y, m, 1);
  return { id: sid, label: `Temporada de ${MESES[m - 1]} ${y}`, start, end, current: now() >= start && now() < end };
}
const softStart = (allTime) => Math.round(1000 + (allTime - 1000) / 2); // arranque de temporada: la mitad de la distancia al 1000
const kFactor = (games, rating) => (games < 10 ? 40 : rating >= 1600 ? 20 : 30);

const q = !db ? null : {
  get: db.prepare('SELECT * FROM players WHERE id = ?'),
  getPub: db.prepare('SELECT * FROM players WHERE pub = ?'),
  ins: db.prepare('INSERT INTO players (id, token_hash, name, created, updated, pub) VALUES (?, ?, ?, ?, ?, ?)'),
  name: db.prepare('UPDATE players SET name = ?, updated = ? WHERE id = ?'),
  top: db.prepare('SELECT id, pub, name, rating, games, wins FROM players WHERE games > 0 AND hidden = 0 ORDER BY rating DESC, wins DESC LIMIT ?'),
  rank: db.prepare('SELECT COUNT(*) AS n FROM players WHERE games > 0 AND hidden = 0 AND rating > ?'),
  cards: db.prepare('SELECT card, n FROM card_plays WHERE player = ? ORDER BY n DESC LIMIT 3'),
  addCard: db.prepare('INSERT INTO card_plays (player, card, n) VALUES (?, ?, ?) ON CONFLICT(player, card) DO UPDATE SET n = n + excluded.n'),
  upd: db.prepare(`UPDATE players SET rating = ?, peak = MAX(peak, ?), games = games + 1, wins = wins + ?, losses = losses + ?, abandons = abandons + ?,
    streak = ?, best_streak = MAX(best_streak, ?), fastest_win = CASE WHEN ? = 1 AND (fastest_win IS NULL OR fastest_win > ?) THEN ? ELSE fastest_win END, updated = ? WHERE id = ?`),
  match: db.prepare('INSERT INTO matches (a, b, winner, reason, turns, ra, rb, delta, ts, season, race_a, race_b, sra, srb, sda, sdb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  sGet: db.prepare('SELECT * FROM season_stats WHERE season = ? AND player = ?'),
  sIns: db.prepare('INSERT INTO season_stats (season, player, rating, peak) VALUES (?, ?, ?, ?)'),
  sUpd: db.prepare('UPDATE season_stats SET rating = ?, peak = MAX(peak, ?), games = games + 1, wins = wins + ?, losses = losses + ?, abandons = abandons + ? WHERE season = ? AND player = ?'),
  sTop: db.prepare(`SELECT p.id, p.pub, p.name, s.rating, s.games, s.wins FROM season_stats s JOIN players p ON p.id = s.player
    WHERE s.season = ? AND s.games > 0 AND p.hidden = 0 ORDER BY s.rating DESC, s.wins DESC, s.games ASC LIMIT ?`),
  sRank: db.prepare(`SELECT COUNT(*) AS n FROM season_stats s JOIN players p ON p.id = s.player WHERE s.season = ? AND s.games > 0 AND p.hidden = 0 AND s.rating > ?`),
  sCount: db.prepare(`SELECT COUNT(*) AS n FROM season_stats s JOIN players p ON p.id = s.player WHERE s.season = ? AND s.games > 0 AND p.hidden = 0`),
  sList: db.prepare('SELECT season, COUNT(*) AS n FROM season_stats WHERE games > 0 GROUP BY season ORDER BY season DESC'),
  sMine: db.prepare('SELECT * FROM season_stats WHERE player = ? AND games > 0 ORDER BY season DESC LIMIT 24'),
  hist: db.prepare(`SELECT m.*, pa.name AS na, pa.pub AS pa, pb.name AS nb, pb.pub AS pb FROM matches m
    LEFT JOIN players pa ON pa.id = m.a LEFT JOIN players pb ON pb.id = m.b WHERE m.a = ? OR m.b = ? ORDER BY m.ts DESC LIMIT ?`),
};

// Identidad de invitado: el cliente genera id + token y los guarda. Más adelante se reemplaza por la cuenta de Steam.
export function auth(id, token, name) {
  if (!db) return MEMAPI.auth(id, token, name);
  if (typeof id !== 'string' || typeof token !== 'string' || id.length < 8 || id.length > 64 || token.length < 16) return null;
  const p = q.get.get(id);
  if (!p) { q.ins.run(id, hash(token), name, now(), now(), pubOf(id)); return q.get.get(id); }
  if (p.token_hash !== hash(token)) return null;
  if (name && name !== p.name && !p.name_locked) q.name.run(name, now(), id); // name_locked: le cambiaron el nombre por reportes
  return q.get.get(id);
}

function seasonRow(season, p) {
  let s = q.sGet.get(season, p.id);
  if (!s) { const r = softStart(p.rating); q.sIns.run(season, p.id, r, r); s = q.sGet.get(season, p.id); }
  return s;
}

// Registra el resultado. Devuelve por asiento { before, after } de la TEMPORADA (lo que ve el jugador) + all: { before, after } histórico.
export function recordMatch({ ids, winner, reason, turns, plays, races = [] }) {
  if (!db) return MEMAPI.recordMatch({ ids, winner, reason, turns, plays });
  const [a, b] = ids.map((id) => q.get.get(id));
  if (!a || !b) return null;
  const season = seasonInfo().id;
  const elo = (ra, rb, ga, gb) => { const ea = 1 / (1 + 10 ** ((rb - ra) / 400)), sa = winner === 0 ? 1 : 0; return [Math.round(kFactor(ga, ra) * (sa - ea)), Math.round(kFactor(gb, rb) * ((1 - sa) - (1 - ea)))]; };
  const res = [];
  db.exec('BEGIN');
  try {
    const [da, db2] = elo(a.rating, b.rating, a.games, b.games);
    const sa = seasonRow(season, a), sb = seasonRow(season, b);
    const [sda, sdb] = elo(sa.rating, sb.rating, sa.games, sb.games);
    for (const [i, p, d, s, sd] of [[0, a, da, sa, sda], [1, b, db2, sb, sdb]]) {
      const won = winner === i ? 1 : 0, r = Math.max(100, p.rating + d), sr = Math.max(100, s.rating + sd);
      const streak = won ? Math.max(0, p.streak) + 1 : 0;
      const abandoned = reason === 'abandon' && !won ? 1 : 0;
      q.upd.run(r, r, won, 1 - won, abandoned, streak, streak, won, turns, turns, now(), p.id);
      q.sUpd.run(sr, sr, won, 1 - won, abandoned, season, p.id);
      for (const [card, n] of Object.entries(plays[i] || {})) q.addCard.run(p.id, Number(card), n);
      res.push({ before: s.rating, after: sr, all: { before: p.rating, after: r } });
    }
    q.match.run(a.id, b.id, winner, reason, turns, a.rating, b.rating, da, now(), season, races[0] ?? null, races[1] ?? null, sa.rating, sb.rating, sda, sdb);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return res;
}

// Ranking. season: 'AAAA-MM' (por defecto la actual) o 'all' (histórico).
export function ranking(season = null, limit = 50) {
  limit = Math.max(1, Math.min(100, Number(limit) || 50));
  if (!db) { const rows = MEMAPI.leaderboard(limit); return { season: seasonInfo(), seasons: [seasonInfo().id], rows }; }
  const seasons = [...new Set([seasonInfo().id, ...q.sList.all().map((x) => x.season)])].sort().reverse();
  if (season === 'all') return { season: { id: 'all', label: 'Histórico' }, seasons, rows: q.top.all(limit).map((p, i) => ({ pos: i + 1, id: p.id.slice(0, 6), pub: p.pub, name: p.name, rating: p.rating, games: p.games, wins: p.wins })) };
  const info = seasonInfo(season);
  return { season: info, seasons, players: q.sCount.get(info.id).n, rows: q.sTop.all(info.id, limit).map((p, i) => ({ pos: i + 1, id: p.id.slice(0, 6), pub: p.pub, name: p.name, rating: p.rating, games: p.games, wins: p.wins })) };
}
// compatibilidad (clientes viejos y la página): arreglo con el top de la temporada actual
export const leaderboard = (limit = 20) => ranking(null, limit).rows;

// Perfil por id secreto (el propio) o por id público (de otros). Con temporada actual, temporadas pasadas e historial.
export function profile(id) {
  if (!db) return MEMAPI.profile(id);
  id = String(id);
  const p = q.get.get(id) || q.getPub.get(id); if (!p) return null;
  const cur = seasonInfo(), sc = q.sGet.get(cur.id, p.id);
  const seasons = q.sMine.all(p.id).filter((s) => s.season !== cur.id).map((s) => ({ ...seasonInfo(s.season), rank: q.sRank.get(s.season, s.rating).n + 1, of: q.sCount.get(s.season).n, rating: s.rating, peak: s.peak, games: s.games, wins: s.wins }));
  const history = q.hist.all(p.id, p.id, 20).map((m) => {
    const me = m.a === p.id ? 0 : 1;
    return { ts: m.ts, won: m.winner === me, reason: m.reason, turns: m.turns, race: me ? m.race_b : m.race_a,
      opp: { pub: me ? m.pa : m.pb, name: me ? m.na : m.nb, race: me ? m.race_a : m.race_b },
      delta: m.sda == null ? null : me ? m.sdb : m.sda, season: m.season };
  });
  return {
    pub: p.pub, name: p.name, rating: p.rating, peak: p.peak, games: p.games, wins: p.wins, losses: p.losses, abandons: p.abandons,
    streak: p.streak, bestStreak: p.best_streak, fastestWin: p.fastest_win, rank: p.games && !p.hidden ? q.rank.get(p.rating).n + 1 : null,
    season: { ...cur, rating: sc?.rating ?? softStart(p.rating), peak: sc?.peak ?? null, games: sc?.games ?? 0, wins: sc?.wins ?? 0, rank: sc?.games && !p.hidden ? q.sRank.get(cur.id, sc.rating).n + 1 : null, of: q.sCount.get(cur.id).n },
    seasons, history,
    favorites: q.cards.all(p.id).map((c) => ({ card: c.card, n: c.n })),
  };
}
export const ratingOf = (id) => (!db ? MEMAPI.ratingOf(id) : q.get.get(id)?.rating ?? 1000);

// ---- reportes (S08, 25/10) ----
export const REPORT_REASONS = ['nombre', 'trampa', 'abandono', 'conducta', 'otro'];
const DAY = 24 * 3600 * 1000;
const qr = !db ? null : {
  byReporter: db.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND ts > ?'),
  pair: db.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter = ? AND target = ? AND ts > ?'),
  ins: db.prepare('INSERT INTO reports (reporter, target, reason, note, ts) VALUES (?, ?, ?, ?, ?)'),
  distinct: db.prepare('SELECT COUNT(DISTINCT reporter) AS n FROM reports WHERE target = ? AND reason = ? AND ts > ?'),
  lockName: db.prepare("UPDATE players SET name = 'Jugador', name_locked = 1, updated = ? WHERE id = ?"),
  pending: db.prepare(`SELECT r.target, p.pub, p.name, p.hidden, p.name_locked, p.games, COUNT(*) AS n, COUNT(DISTINCT r.reporter) AS reporters,
    GROUP_CONCAT(r.reason) AS reasons, GROUP_CONCAT(COALESCE(r.note, ''), ' | ') AS notes, MAX(r.ts) AS last
    FROM reports r JOIN players p ON p.id = r.target WHERE r.done = 0 GROUP BY r.target ORDER BY reporters DESC, last DESC LIMIT 100`),
  done: db.prepare('UPDATE reports SET done = 1 WHERE target = ?'),
  hide: db.prepare('UPDATE players SET hidden = ? WHERE id = ?'),
  unlock: db.prepare('UPDATE players SET name_locked = 0 WHERE id = ?'),
  del: [ // borrado a pedido (privacidad): jugador, estadísticas, temporadas, reportes; en las partidas del rival queda como "borrado"
    db.prepare('DELETE FROM card_plays WHERE player = ?'), db.prepare('DELETE FROM season_stats WHERE player = ?'),
    db.prepare('DELETE FROM reports WHERE target = ? OR reporter = ?'), db.prepare("UPDATE matches SET a = 'borrado' WHERE a = ?"),
    db.prepare("UPDATE matches SET b = 'borrado' WHERE b = ?"), db.prepare('DELETE FROM daily WHERE player = ?'), db.prepare('DELETE FROM players WHERE id = ?')],
  oldMatches: db.prepare('DELETE FROM matches WHERE ts < ?'),
  oldReports: db.prepare('DELETE FROM reports WHERE done = 1 AND ts < ?'),
};
// Devuelve { ok } o { error }. Límites: 10 reportes por día por jugador, 1 por día al mismo jugador, hay que haber jugado.
// Acción automática: si 3 jugadores distintos reportan el NOMBRE en 7 días, pasa a "Jugador" y no lo puede cambiar.
export function report({ pid, ptoken, target, reason, note }) {
  if (!db) return { error: 'sin base' };
  const me = typeof pid === 'string' ? q.get.get(pid) : null;
  if (!me || me.token_hash !== hash(ptoken)) return { error: 'identidad' };
  const t = q.getPub.get(String(target || '')); if (!t) return { error: 'jugador' };
  if (t.id === me.id) return { error: 'vos' };
  if (!REPORT_REASONS.includes(reason)) return { error: 'motivo' };
  if (me.games < 1) return { error: 'jugá primero' };
  if (qr.byReporter.get(me.id, now() - DAY).n >= 10) return { error: 'límite' };
  if (qr.pair.get(me.id, t.id, now() - DAY).n >= 1) return { ok: true, repeated: true };
  qr.ins.run(me.id, t.id, reason, note ? String(note).replace(/[<>]/g, '').slice(0, 200) : null, now());
  if (reason === 'nombre' && !t.name_locked && qr.distinct.get(t.id, 'nombre', now() - 7 * DAY).n >= 3) qr.lockName.run(now(), t.id);
  return { ok: true };
}
// Para revisar (con la clave ADMIN_KEY): reportes pendientes agrupados por jugador
export const pendingReports = () => (db ? qr.pending.all() : []);
// acciones: hide (sacar del ranking), unhide, rename (nombre "Jugador" y bloqueado), unlock (puede volver a cambiar el nombre), done (archivar)
export function adminAction(pub, action) {
  if (!db) return { error: 'sin base' };
  const t = q.getPub.get(String(pub || '')); if (!t) return { error: 'jugador' };
  if (action === 'delete') { db.exec('BEGIN'); try { qr.del.forEach((st, i) => (i === 2 ? st.run(t.id, t.id) : st.run(t.id))); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return { ok: true, deleted: true }; }
  if (action === 'hide') qr.hide.run(1, t.id); else if (action === 'unhide') qr.hide.run(0, t.id);
  else if (action === 'rename') qr.lockName.run(now(), t.id); else if (action === 'unlock') qr.unlock.run(t.id);
  else if (action !== 'done') return { error: 'acción' };
  qr.done.run(t.id);
  return { ok: true };
}

// Plazos (privacidad, pedido de S07): el historial de partidas se guarda HISTORY_DAYS días (por defecto 730 = 2 años; las
// estadísticas y temporadas quedan) y los reportes ya revisados, 180 días. Se limpia al arrancar y una vez por día.
export function cleanup() {
  if (!db) return;
  const days = Number(process.env.HISTORY_DAYS) || 730;
  qr.oldMatches.run(now() - days * DAY); qr.oldReports.run(now() - 180 * DAY);
}
if (db) { try { cleanup(); } catch (e) { console.error('limpieza', e.message); } setInterval(() => { try { cleanup(); } catch {} }, DAY).unref(); }
