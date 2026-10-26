import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { AsedioRoom } from './AsedioRoom.mjs';
import * as DB from './db.mjs';
import { ENG } from './version.mjs';
import * as DIARIO from './diario.mjs';

// Último instalador de Windows (Releases del repo público). Se consulta a GitHub como mucho 1 vez cada 15 min;
// si falla, se manda a la página de la última versión.
const RELEASES = 'https://github.com/Neosailex/thrones-and-siege-releases/releases/latest';
let INST = { url: RELEASES, at: 0 };
async function latestInstaller() {
  if (Date.now() - INST.at < 15 * 60000) return INST.url;
  INST.at = Date.now();
  try { const j = await (await fetch('https://api.github.com/repos/Neosailex/thrones-and-siege-releases/releases/latest', { headers: { 'User-Agent': 'thrones-and-siege' }, signal: AbortSignal.timeout(5000) })).json();
    const a = (j.assets || []).find((x) => /\.exe$/i.test(x.name)); INST.url = a?.browser_download_url || RELEASES; } catch { INST.url = RELEASES; }
  return INST.url;
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function startServer({ port = Number(process.env.PORT) || 2567, staticDir = path.join(ROOT, 'dist') } = {}) {
const PORT = port;
const app = express();
app.set('trust proxy', true);
// ---- sitio público (S08, 24/10): "/" = página de presentación, "/jugar/" = el juego, "/descargar" = último instalador ----
// Caché: los archivos con hash de Vite (assets/*) se guardan para siempre; todo lo demás se revalida siempre
// (no-cache + ETag por contenido), así nunca queda una versión vieja y lo que no cambió no se vuelve a bajar (304).
try { const { default: compression } = await import('compression'); app.use(compression()); } catch {} // opcional (la app de escritorio no la trae)
const SITE = path.join(ROOT, 'deploy');
const LANDING = path.join(SITE, 'landing.html');
const ETAGS = new Map(); // ruta -> [mtime, size, etag] (hash del contenido: el mismo archivo da el mismo ETag en cada deploy)
const contentTag = (file, st) => { const c = ETAGS.get(file); if (c && c[0] === st.mtimeMs && c[1] === st.size) return c[2];
  const t = '"' + crypto.createHash('sha1').update(fs.readFileSync(file)).digest('base64url').slice(0, 22) + '"'; ETAGS.set(file, [st.mtimeMs, st.size, t]); return t; };
const cacheHeaders = (r, file, st) => {
  if (/[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8}\.\w+$/.test(file)) r.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  else { r.setHeader('Cache-Control', 'no-cache'); r.setHeader('ETag', contentTag(file, st)); }
};
const serve = (dir) => express.static(dir, { lastModified: false, setHeaders: cacheHeaders });
// la app de escritorio (origen app://) y otros sitios leen el ranking y los jugadores online
app.use(['/api', '/stats'], (q, r, next) => { r.setHeader('Access-Control-Allow-Origin', '*'); if (q.method === 'OPTIONS') { r.setHeader('Access-Control-Allow-Methods', 'GET, POST'); r.setHeader('Access-Control-Allow-Headers', 'content-type'); return r.sendStatus(204); } next(); });
app.use('/api', express.json({ limit: '4kb' }));
app.get('/', (q, r, next) => { if (q.query.server || process.env.NO_LANDING) return next(); r.setHeader('Cache-Control', 'no-cache'); r.sendFile(LANDING, (e) => e && next()); });
app.get('/ranking', (_q, r) => { r.setHeader('Cache-Control', 'no-cache'); r.sendFile(path.join(SITE, 'ranking.html')); }); // ranking y perfiles en la web (?p=<id público>)
app.use('/sitio', serve(path.join(SITE, 'sitio'))); // imágenes y estilos de la página de presentación (S04)
app.use('/jugar', serve(staticDir));
app.get('/descargar', async (_q, r) => r.redirect(302, await latestInstaller()));
app.use(serve(staticDir));
app.get('/health', (_q, r) => r.send('ok'));
app.get('/version', (_q, r) => { r.setHeader('Access-Control-Allow-Origin', '*'); r.json({ eng: ENG }); }); // huella del motor (ver version.mjs)
app.get('/api/leaderboard', (_q, r) => r.json(DB.leaderboard(20))); // compatibilidad: top 20 de la temporada actual
// ranking con temporadas (S08, 25/10): ?season=AAAA-MM | all (histórico), ?limit=1..100
app.get('/api/ranking', (q, r) => r.json(DB.ranking(q.query.season ? String(q.query.season) : null, q.query.limit)));
// desafío diario de campaña (S08, 25/10; API en docs/sesiones/S08 "Desafío diario")
const answer = (r, x) => r.status(x.ok || !x.error ? 200 : x.error === 'ya jugaste' ? 409 : x.error === 'identidad' ? 401 : 400).json(x);
app.get('/api/diario', (q, r) => r.json(DIARIO.ranking(q.query.dia ? String(q.query.dia) : null, q.query.limit)));
app.get('/api/diario/hoy', (_q, r) => { const i = DIARIO.dayInfo(); r.json({ ...i, maxFloor: DIARIO.MAX_FLOOR, winMinFloor: DIARIO.WIN_MIN_FLOOR, rules: DIARIO.RULES }); });
app.post('/api/diario/empezar', (q, r) => answer(r, DIARIO.start(q.body || {})));
app.post('/api/diario/yo', (q, r) => answer(r, DIARIO.mine(q.body || {})));
app.post('/api/diario/resultado', (q, r) => answer(r, DIARIO.finish(q.body || {})));
app.get('/diario', (_q, r) => { r.setHeader('Cache-Control', 'no-cache'); r.sendFile(path.join(SITE, 'diario.html')); }); // ranking del día en la web
// reportar jugador (S08, 25/10): { pid, ptoken, target (id público), reason, note }
app.post('/api/report', (q, r) => { const x = DB.report(q.body || {}); r.status(x.ok ? 200 : 400).json(x); });
// revisión de reportes: solo con la clave ADMIN_KEY (en Fly: fly secrets set ADMIN_KEY=...). Sin clave cargada, apagado.
const adminOk = (k) => !!process.env.ADMIN_KEY && typeof k === 'string' && k.length === process.env.ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(process.env.ADMIN_KEY));
app.get('/api/admin/reports', (q, r) => (adminOk(q.query.key) ? r.json(DB.pendingReports()) : r.sendStatus(403)));
app.post('/api/admin/action', (q, r) => (adminOk(q.body?.key) ? r.json(DB.adminAction(q.body.target, q.body.action)) : r.sendStatus(403)));
app.get('/api/profile/:id', (q, r) => { const p = DB.profile(q.params.id); p ? r.json(p) : r.status(q.query.soft ? 200 : 404).json({ error: 'sin partidas' }); }); // soft: sin 404 en la consola del cliente
app.get('/stats', async (_q, r) => {
  const rooms = await matchMaker.query({}); // públicas ('asedio') y privadas con código ('amigos')
  r.json({ online: rooms.reduce((a, x) => a + x.clients, 0), waiting: rooms.filter((x) => x.name === 'asedio' && x.clients === 1 && !x.locked).length });
});

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
// joinOrCreate + maxClients 2 = emparejamiento automático: el primero espera, el segundo completa la sala.
gameServer.define('asedio', AsedioRoom);
// Sala privada con amigos: create('amigos') devuelve un código de 5 letras (room.roomId); el otro entra con joinById(código).
gameServer.define('amigos', AsedioRoom, { priv: true });
await gameServer.listen(PORT);
console.log(`Asedio online en http://localhost:${PORT}`);
// backup diario del ranking (se guardan los últimos 7)
try { const dbf = process.env.DB_FILE || path.resolve('data/asedio.db'); const dir = path.join(path.dirname(dbf), 'backups');
  const backup = () => { try { if (!fs.existsSync(dbf)) return; fs.mkdirSync(dir, { recursive: true }); const name = path.join(dir, `asedio-${new Date().toISOString().slice(0, 10)}.db`); fs.copyFileSync(dbf, name); const old = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().slice(0, -7); for (const f of old) fs.unlinkSync(path.join(dir, f)); } catch (e) { console.error('backup', e.message); } };
  setTimeout(backup, 60000); setInterval(backup, 24 * 3600 * 1000); } catch {}
return { port: PORT, stop: () => gameServer.gracefullyShutdown(false) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startServer();
