'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

app.disableHardwareAcceleration();

// ── Path detection ─────────────────────────────────────────────────────────

function discordCandidates() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return [
      path.join(local, 'Discord'),
      path.join(local, 'DiscordPTB'),
      path.join(local, 'DiscordCanary'),
    ];
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Discord.app/Contents/Resources',
      '/Applications/Discord PTB.app/Contents/Resources',
      '/Applications/Discord Canary.app/Contents/Resources',
    ];
  }
  return [
    '/usr/share/discord/resources',
    path.join(home, '.local', 'share', 'discord', 'resources'),
  ];
}

function findDiscordResources() {
  for (const candidate of discordCandidates()) {
    if (!fs.existsSync(candidate)) continue;

    if (process.platform === 'win32') {
      let entries;
      try { entries = fs.readdirSync(candidate); } catch (_) { continue; }
      const appDirs = entries
        .filter(e => /^app-\d+\.\d+\.\d+$/.test(e))
        .sort()
        .reverse();
      for (const dir of appDirs) {
        const res = path.join(candidate, dir, 'resources');
        if (fs.existsSync(res)) return res;
      }
    } else {
      if (fs.existsSync(path.join(candidate, 'app.asar'))) return candidate;
    }
  }
  return null;
}

function readDiscordVersion(resourcesPath) {
  if (!resourcesPath) return 'Not found';
  const match = resourcesPath.match(/app-(\d+\.\d+\.\d+)/);
  if (match) return match[1];
  const plist = path.join(resourcesPath, '..', 'Info.plist');
  if (fs.existsSync(plist)) {
    try {
      const text = fs.readFileSync(plist, 'utf8');
      const m = text.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
      if (m) return m[1];
    } catch (_) {}
  }
  return 'Unknown';
}

// ── File utilities ─────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src,  entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDirSync(s, d) : fs.copyFileSync(s, d);
  }
}

function rmDirSync(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ── Locate CottonCord src/ ─────────────────────────────────────────────────

function getCottonCordSrc() {
  const devSrc = path.join(__dirname, '..', 'src');
  if (fs.existsSync(devSrc)) return devSrc;
  const pkgSrc = path.join(process.resourcesPath, 'src');
  if (fs.existsSync(pkgSrc)) return pkgSrc;
  throw new Error('Cannot locate CottonCord src/ directory.');
}

// ── Install / Uninstall ────────────────────────────────────────────────────

function doInstall(resourcesPath) {
  const appDir = path.join(resourcesPath, 'app');
  const src    = getCottonCordSrc();

  fs.mkdirSync(appDir, { recursive: true });

  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({ name: 'cottoncord', main: 'index.js' }, null, 2),
  );

  fs.writeFileSync(path.join(appDir, 'index.js'), [
    "'use strict';",
    "try { require('./src/injector/index.js'); }",
    "catch (err) { require('../app.asar'); }",
  ].join('\n'));

  copyDirSync(src, path.join(appDir, 'src'));
}

function doUninstall(resourcesPath) {
  rmDirSync(path.join(resourcesPath, 'app'));
}

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('get-info', () => {
  const resources = findDiscordResources();
  return {
    resourcesPath: resources,
    version:       readDiscordVersion(resources),
    installed:     resources ? fs.existsSync(path.join(resources, 'app')) : false,
  };
});

ipcMain.handle('install', async () => {
  const resources = findDiscordResources();
  if (!resources) return { ok: false, msg: 'Discord installation not found. Is Discord installed?' };
  try {
    doInstall(resources);
    return { ok: true, msg: 'Installation complete — restart Discord to activate CottonCord.' };
  } catch (err) {
    return { ok: false, msg: `Install failed: ${err.message}` };
  }
});

ipcMain.handle('reinstall', async () => {
  const resources = findDiscordResources();
  if (!resources) return { ok: false, msg: 'Discord installation not found. Is Discord installed?' };
  try {
    doUninstall(resources);
    doInstall(resources);
    return { ok: true, msg: 'Reinstallation complete — restart Discord to activate CottonCord.' };
  } catch (err) {
    return { ok: false, msg: `Reinstall failed: ${err.message}` };
  }
});

ipcMain.handle('uninstall', async () => {
  const resources = findDiscordResources();
  if (!resources) return { ok: false, msg: 'Discord installation not found.' };
  try {
    doUninstall(resources);
    return { ok: true, msg: 'Uninstalled — restart Discord to restore default behaviour.' };
  } catch (err) {
    return { ok: false, msg: `Uninstall failed: ${err.message}` };
  }
});

// ── Window ─────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width:           480,
    height:          320,
    resizable:       false,
    maximizable:     false,
    fullscreenable:  false,
    autoHideMenuBar: true,
    center:          true,
    title:           'CottonCord Installer',
    backgroundColor: '#313338',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'ui', 'installer.html'));
});

app.on('window-all-closed', () => app.quit());
