// Actualizador del juego: baja solo los archivos que cambiaron desde el repo público de GitHub.
// La "cáscara" (Electron, main.cjs, launcher) viene con el instalador; el juego (app/ y app-server/) se actualiza solo.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const SHELL_VERSION = 1; // subir si cambia main.cjs/launcher de forma incompatible (pide reinstalar)
const BASE = 'https://raw.githubusercontent.com/Neosailex/thrones-and-siege-releases/main';
const PAGE = 'https://github.com/Neosailex/thrones-and-siege-releases/releases/latest';

const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
async function sha1File(f) { try { return sha1(await fsp.readFile(f)); } catch { return null; } }
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
// en Windows un archivo abierto (antivirus, video del launcher) puede trabar el renombre unos instantes
async function retry(fn, n = 6) { for (let k = 0; ; k++) { try { return await fn(); } catch (e) { if (k >= n - 1 || !/EBUSY|EPERM|EACCES/.test(e.code || '')) throw e; await new Promise((ok) => setTimeout(ok, 400 * (k + 1))); } } }

function createUpdater({ bundledDir, userDir, fetchImpl, nodeModulesDir, base = BASE }) {
  const GAME = path.join(userDir, 'game');
  const bundledVersion = () => (readJson(path.join(bundledDir, 'app', 'version.json')) || {}).version || '0.0.0';
  const installedVersion = () => (readJson(path.join(GAME, 'version.json')) || {}).version || null;
  // carpeta desde donde se juega: la descargada si es más nueva que la que vino con el instalador
  function currentDir() {
    const iv = installedVersion();
    if (iv && cmpVer(iv, bundledVersion()) > 0 && fs.existsSync(path.join(GAME, 'app', 'index.html'))) return GAME;
    return bundledDir;
  }
  const currentVersion = () => (currentDir() === GAME ? installedVersion() : bundledVersion());

  async function getJson(url, ms = 8000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try { const r = await fetchImpl(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  // raw.githubusercontent cachea unos minutos: pedimos el commit actual a la API y bajamos todo fijado a ese commit
  let pinned = base;
  async function pin() {
    pinned = base;
    if (!base.startsWith('https://raw.githubusercontent.com/')) return;
    const repo = base.replace('https://raw.githubusercontent.com/', '').split('/').slice(0, 2).join('/');
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetchImpl(`https://api.github.com/repos/${repo}/commits/main`, { signal: ctl.signal, cache: 'no-store', headers: { Accept: 'application/vnd.github.sha' } });
      const sha = r.ok ? (await r.text()).trim() : '';
      if (/^[0-9a-f]{40}$/.test(sha)) pinned = `https://raw.githubusercontent.com/${repo}/${sha}`;
    } catch {} finally { clearTimeout(t); }
  }
  async function check() {
    await pin();
    const latest = await getJson(`${pinned}/latest.json?t=${Date.now()}`);
    const cur = currentVersion();
    return { current: cur, latest: latest.version, notes: latest.notes || '', size: latest.size || 0, needsShell: (latest.minShell || 1) > SHELL_VERSION, available: cmpVer(latest.version, cur) > 0, page: PAGE, manifest: latest };
  }
  async function download(url, tries = 3) {
    for (let k = 0; ; k++) {
      try { const r = await fetchImpl(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return Buffer.from(await r.arrayBuffer()); }
      catch (e) { if (k >= tries - 1) throw e; await new Promise((ok) => setTimeout(ok, 800 * (k + 1))); }
    }
  }
  // Arma la versión nueva en una carpeta aparte y recién al final la pone en uso (si algo falla, queda la anterior)
  async function update(manifest, onProgress = () => {}) {
    const src = currentDir(), stage = GAME + '.nuevo', old = GAME + '.viejo';
    await fsp.rm(stage, { recursive: true, force: true }); await fsp.mkdir(stage, { recursive: true });
    const files = Object.entries(manifest.files), todo = [];
    let reused = 0;
    for (const [rel, h] of files) {
      const local = path.join(src, ...rel.split('/'));
      if ((await sha1File(local)) === h) { const dst = path.join(stage, ...rel.split('/')); await fsp.mkdir(path.dirname(dst), { recursive: true }); await fsp.copyFile(local, dst); reused++; }
      else todo.push([rel, h]);
    }
    const total = todo.reduce((a, [rel]) => a + (manifest.sizes?.[rel] || 1), 0) || 1; let done = 0, n = 0;
    onProgress({ phase: 'download', done: 0, total, files: todo.length, reused });
    const queue = todo.slice();
    async function worker() {
      while (queue.length) {
        const [rel, h] = queue.shift();
        const buf = await download(`${pinned}/game/${enc(rel)}?v=${manifest.version}`);
        if (sha1(buf) !== h) throw new Error('Archivo dañado: ' + rel);
        const dst = path.join(stage, ...rel.split('/')); await fsp.mkdir(path.dirname(dst), { recursive: true }); await fsp.writeFile(dst, buf);
        done += manifest.sizes?.[rel] || 1; n++; onProgress({ phase: 'download', done, total, files: todo.length, got: n, reused });
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    await fsp.writeFile(path.join(stage, 'version.json'), JSON.stringify({ version: manifest.version, notes: manifest.notes || '' }));
    await fsp.writeFile(path.join(stage, 'app', 'version.json'), JSON.stringify({ version: manifest.version }));
    // el servidor para "Hostear partida" usa las librerías que vinieron con el instalador
    if (nodeModulesDir && fs.existsSync(nodeModulesDir)) { try { await fsp.symlink(nodeModulesDir, path.join(stage, 'node_modules'), 'junction'); } catch {} }
    onProgress({ phase: 'install' });
    await fsp.rm(old, { recursive: true, force: true });
    if (fs.existsSync(GAME)) await retry(() => fsp.rename(GAME, old));
    await retry(() => fsp.rename(stage, GAME));
    await fsp.rm(old, { recursive: true, force: true }).catch(() => {});
    onProgress({ phase: 'done', version: manifest.version });
    return { version: manifest.version, downloaded: todo.length, reused };
  }
  return { check, update, currentDir, currentVersion, bundledVersion, SHELL_VERSION, PAGE };
}
module.exports = { createUpdater, cmpVer };
