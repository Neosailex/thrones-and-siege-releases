import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { AsedioRoom } from './AsedioRoom.mjs';
import * as DB from './db.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function startServer({ port = Number(process.env.PORT) || 2567, staticDir = path.join(ROOT, 'dist') } = {}) {
const PORT = port;
const app = express();
app.set('trust proxy', true);
// página de inicio (/) y el juego (/jugar)
const LANDING = path.join(ROOT, 'deploy', 'landing.html');
app.get('/', (q, r, next) => { if (q.query.server || process.env.NO_LANDING) return next(); r.sendFile(LANDING, (e) => e && next()); });
app.use('/jugar', express.static(staticDir));
app.use(express.static(staticDir));
app.get('/health', (_q, r) => r.send('ok'));
app.get('/api/leaderboard', (_q, r) => r.json(DB.leaderboard(20)));
app.get('/api/profile/:id', (q, r) => { const p = DB.profile(q.params.id); p ? r.json(p) : r.status(q.query.soft ? 200 : 404).json({ error: 'sin partidas' }); }); // soft: sin 404 en la consola del cliente
app.get('/stats', async (_q, r) => {
  const rooms = await matchMaker.query({ name: 'asedio' });
  r.json({ online: rooms.reduce((a, x) => a + x.clients, 0), waiting: rooms.filter((x) => x.clients === 1 && !x.locked).length });
});

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
// joinOrCreate + maxClients 2 = emparejamiento automático: el primero espera, el segundo completa la sala.
gameServer.define('asedio', AsedioRoom);
await gameServer.listen(PORT);
console.log(`Asedio online en http://localhost:${PORT}`);
// backup diario del ranking (se guardan los últimos 7)
try { const fs = await import('node:fs'); const dbf = process.env.DB_FILE || path.resolve('data/asedio.db'); const dir = path.join(path.dirname(dbf), 'backups');
  const backup = () => { try { if (!fs.existsSync(dbf)) return; fs.mkdirSync(dir, { recursive: true }); const name = path.join(dir, `asedio-${new Date().toISOString().slice(0, 10)}.db`); fs.copyFileSync(dbf, name); const old = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().slice(0, -7); for (const f of old) fs.unlinkSync(path.join(dir, f)); } catch (e) { console.error('backup', e.message); } };
  setTimeout(backup, 60000); setInterval(backup, 24 * 3600 * 1000); } catch {}
return { port: PORT, stop: () => gameServer.gracefullyShutdown(false) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await startServer();
