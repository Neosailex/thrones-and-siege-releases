// App de escritorio de Thrones & Siege: launcher con actualización automática + el juego en una ventana propia.
const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Protocolo propio app:// para servir los archivos del juego (permite fetch, audio y guardado local).
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
const { createUpdater } = require('./updater.cjs');
let UPD = null; // se crea cuando la app está lista (necesita la carpeta de datos del usuario)
let ROOT = path.join(__dirname, 'app'); // carpeta del juego en uso (la del instalador o la actualizada)
let LATEST = null;

if (!app.requestSingleInstanceLock()) app.quit();
// el sonido ambiente del launcher arranca sin esperar un clic
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let LWIN = null, GWIN = null; // ventana del launcher (sin marco) y del juego

const ICON = path.join(__dirname, 'app', 'icon.png');
const webPreferences = () => ({ contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') });
function common(win) {
  // links externos (por ejemplo los créditos) se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}
// Launcher: ventana sin marco (la barra de título la dibuja el launcher).
function createLauncherWindow() {
  const win = new BrowserWindow({ width: 1280, height: 800, minWidth: 900, minHeight: 560, frame: false, backgroundColor: '#0d0907', title: 'Thrones & Siege', icon: ICON, show: false, webPreferences: webPreferences() });
  common(win); win.once('ready-to-show', () => win.show()); setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 3000);
  return win;
}
// Juego: ventana normal con marco.
function createGameWindow(from) {
  const b = from && !from.isDestroyed() ? from.getBounds() : null;
  const win = new BrowserWindow({ ...(b ? { x: b.x, y: b.y, width: b.width, height: b.height } : { width: 1280, height: 800 }), minWidth: 900, minHeight: 560, backgroundColor: '#15110d', title: 'Thrones & Siege', icon: ICON, show: false, webPreferences: webPreferences() });
  common(win); return win;
}
// La interfaz del launcher viene con el juego (app/launcher/index.html) para que se actualice sola.
// Orden: la versión descargada, la del instalador y, si todo falla, desktop/launcher.html.
function loadLauncher(win) {
  const dirs = [...new Set([UPD.currentDir(), __dirname])].map((d) => path.join(d, 'app')).filter((d) => fs.existsSync(path.join(d, 'launcher', 'index.html')));
  let k = 0, timer = null;
  const next = () => {
    clearTimeout(timer);
    if (win.isDestroyed()) return;
    if (k >= dirs.length) { win.webContents.removeListener('did-fail-load', fail); win.loadFile(path.join(__dirname, 'launcher.html')); return; }
    ROOT = dirs[k++]; win.__ready = false;
    win.loadURL('app://game/launcher/index.html');
    timer = setTimeout(() => { if (!win.__ready) next(); }, 9000); // si no avisa que arrancó, probamos el siguiente
  };
  const fail = (e, code, desc, url, isMain) => { if (isMain !== false && String(url).startsWith('app://')) next(); };
  win.webContents.on('did-fail-load', fail);
  win.webContents.once('render-process-gone', () => next());
  win.__launcherReady = () => { win.__ready = true; clearTimeout(timer); };
  next();
}
const fromWin = (e) => BrowserWindow.fromWebContents(e.sender);

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  UPD = createUpdater({ bundledDir: __dirname, userDir: app.getPath('userData'), fetchImpl: (u, o) => net.fetch(u, o), nodeModulesDir: path.join(__dirname, 'node_modules'), base: process.env.TS_UPDATE_BASE || undefined });
  const win = LWIN = createLauncherWindow(); loadLauncher(win);
  ipcMain.handle('launcher:info', (e) => { let notes = ''; try { notes = JSON.parse(fs.readFileSync(path.join(UPD.currentDir(), 'version.json'), 'utf8')).notes || ''; } catch {} return { current: UPD.currentVersion(), notes, frameless: fromWin(e) === LWIN, shell: UPD.SHELL_VERSION, page: UPD.PAGE }; });
  ipcMain.handle('launcher:ready', (e) => { const w = fromWin(e); w?.__launcherReady?.(); return true; });
  ipcMain.handle('launcher:win', (e, a) => { const w = fromWin(e); if (!w) return false; if (a === 'min') w.minimize(); else if (a === 'max') (w.isMaximized() ? w.unmaximize() : w.maximize()); else if (a === 'close') w.close(); return true; });
  ipcMain.handle('launcher:quit', () => { app.quit(); return true; });
  ipcMain.handle('launcher:folder', async () => { const d = UPD.currentDir(); return (await shell.openPath(d)) === ''; });
  ipcMain.handle('launcher:check', async () => { const c = await UPD.check(); LATEST = c.manifest; const { manifest, ...rest } = c; return rest; });
  ipcMain.handle('launcher:update', async (e) => { const w = fromWin(e); return UPD.update(LATEST, (p) => { if (w && !w.isDestroyed()) w.webContents.send('launcher:progress', p); }); });
  // el juego abre en su propia ventana (con marco) y el launcher se cierra
  ipcMain.handle('launcher:play', (e) => {
    const from = fromWin(e); ROOT = path.join(UPD.currentDir(), 'app');
    if (from && from !== LWIN) { from.loadURL('app://game/index.html'); return true; } // launcher viejo en ventana normal
    const g = GWIN = createGameWindow(from);
    g.once('ready-to-show', () => { if (from?.isMaximized()) g.maximize(); g.show(); g.focus(); if (from && !from.isDestroyed()) from.close(); LWIN = null; });
    g.on('closed', () => { if (GWIN === g) GWIN = null; });
    g.loadURL('app://game/index.html');
    return true;
  });
  ipcMain.handle('launcher:open', (e, url) => { if (/^https:\/\/github\.com\//.test(url)) shell.openExternal(url); return true; });
  app.on('second-instance', () => { const w = GWIN || LWIN; if (!w || w.isDestroyed()) return; if (w.isMinimized()) w.restore(); w.focus(); });
});
// ---- Hostear partida: el servidor del juego corre dentro de la app ----
let HOST = null;
const PORT = 2567;
function localIps() { return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address); }
async function upnpMap() {
  return new Promise((resolve) => {
    let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const nat = require('nat-upnp'); const c = nat.createClient();
      c.portMapping({ public: PORT, private: PORT, ttl: 0, description: 'Thrones & Siege' }, (err) => {
        if (err) { c.close(); return fin({ ok: false }); }
        c.externalIp((e2, ip) => { c.close(); fin({ ok: true, ip: e2 ? null : ip }); });
      });
      setTimeout(() => { try { c.close(); } catch {} fin({ ok: false }); }, 6000);
    } catch { fin({ ok: false }); }
  });
}
async function publicIp() { try { const r = await net.fetch('https://api.ipify.org?format=json'); const j = await r.json(); return j.ip; } catch { return null; } }
ipcMain.handle('host:start', async () => {
  if (!HOST) {
    const mod = await import(pathToFileURL(path.join(UPD ? UPD.currentDir() : __dirname, 'app-server', 'server', 'index.mjs')).toString());
    const srv = await mod.startServer({ port: PORT, staticDir: ROOT });
    const [upnp, pub] = await Promise.all([upnpMap(), publicIp()]);
    HOST = { srv, port: PORT, localIps: localIps(), upnp: upnp.ok, publicIp: upnp.ip || pub };
  }
  return { port: HOST.port, localIps: HOST.localIps, upnp: HOST.upnp, publicIp: HOST.publicIp };
});
ipcMain.handle('host:stop', async () => { if (HOST) { try { await HOST.srv.stop(); } catch {} HOST = null; } return true; });
ipcMain.handle('host:info', async () => (HOST ? { port: HOST.port, localIps: HOST.localIps, upnp: HOST.upnp, publicIp: HOST.publicIp } : null));
app.on('window-all-closed', () => app.quit());
