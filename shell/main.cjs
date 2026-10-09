// App de escritorio de Thrones & Siege: launcher con actualización automática + el juego en una ventana propia.
const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 560, backgroundColor: '#15110d', title: 'Thrones & Siege',
    icon: path.join(__dirname, 'app', 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  win.loadFile(path.join(__dirname, 'launcher.html'));
  // links externos (por ejemplo los créditos) se abren en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  return win;
}

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
  const win = createWindow();
  ipcMain.handle('launcher:info', () => ({ current: UPD.currentVersion() }));
  ipcMain.handle('launcher:check', async () => { const c = await UPD.check(); LATEST = c.manifest; const { manifest, ...rest } = c; return rest; });
  ipcMain.handle('launcher:update', async () => UPD.update(LATEST, (p) => { if (!win.isDestroyed()) win.webContents.send('launcher:progress', p); }));
  ipcMain.handle('launcher:play', () => { ROOT = path.join(UPD.currentDir(), 'app'); win.loadURL('app://game/index.html'); return true; });
  ipcMain.handle('launcher:open', (e, url) => { if (/^https:\/\/github\.com\//.test(url)) shell.openExternal(url); return true; });
  app.on('second-instance', () => { if (win.isMinimized()) win.restore(); win.focus(); });
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
