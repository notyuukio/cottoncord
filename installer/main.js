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
      if (fs.existsSync(path.join(candidate, 'app.asar')) ||
          fs.existsSync(path.join(candidate, '_app.asar'))) return candidate;
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
  // In the packaged installer: src/ is at resources/src via extraResources.
  // __dirname inside app.asar resolves to the asar root which sits in resources/.
  const candidates = [
    path.join(__dirname, '..', 'src'),      // packaged: resources/src
    path.join(process.resourcesPath, 'src'), // explicit resourcesPath
    path.join(__dirname, '..', '..', 'src'), // dev: installer/../src
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isDirectory()) return c; } catch (_) {}
  }
  throw new Error('Cannot locate CottonCord src/ directory.');
}

// ── Minimal ASAR builder ───────────────────────────────────────────────────
// Creates a valid ASAR archive containing a single JS file.
// This avoids a dependency on @electron/asar at runtime.
// Format: [4-byte outer-pickle-size][4-byte header-pickle-size][header-pickle][file-bytes]
// The "pickle" for a string is: [4-byte LE string-length][string bytes][padding to 4-byte align]

function buildMinimalAsar(filename, jsContent) {
  const fileBuf    = Buffer.from(jsContent, 'utf8');
  const headerJson = JSON.stringify({ files: { [filename]: { size: fileBuf.length, offset: '0' } } });
  const headerRaw  = Buffer.from(headerJson, 'utf8');

  // Inner pickle: 4-byte length + raw bytes + alignment padding
  const innerLen     = 4 + headerRaw.length;
  const innerPadded  = Math.ceil(innerLen / 4) * 4;
  const innerPickle  = Buffer.alloc(innerPadded, 0);
  innerPickle.writeUInt32LE(headerRaw.length, 0);
  headerRaw.copy(innerPickle, 4);

  // Outer pickle: [4-byte LE = 4][4-byte LE = innerPickle.length]
  const outerPickle = Buffer.alloc(8);
  outerPickle.writeUInt32LE(4, 0);
  outerPickle.writeUInt32LE(innerPickle.length, 4);

  return Buffer.concat([outerPickle, innerPickle, fileBuf]);
}

// ── Install / Uninstall ────────────────────────────────────────────────────

function isInstalled(resourcesPath) {
  return fs.existsSync(path.join(resourcesPath, 'app.asar.bak'));
}

function doInstall(resourcesPath) {
  const src        = getCottonCordSrc();
  const appAsarPath = path.join(resourcesPath, 'app.asar');
  const backupPath  = path.join(resourcesPath, 'app.asar.bak');
  const ccDir       = path.join(resourcesPath, 'cottoncord');

  // Step 1: Copy CottonCord source into resources/cottoncord/ (bootstrap won't touch this)
  rmDirSync(ccDir);
  copyDirSync(src, ccDir);

  // Step 2: Back up the original app.asar stub (only once)
  if (!fs.existsSync(backupPath)) {
    if (fs.existsSync(appAsarPath)) {
      fs.copyFileSync(appAsarPath, backupPath);
    }
  }

  // Step 3: Write a patched app.asar that loads CottonCord then chains to Discord.
  // __dirname inside this ASAR resolves to resources/, so ../cottoncord is correct.
  const loaderJs = [
    "'use strict';",
    "const path = require('path');",
    "const fs   = require('fs');",
    "try {",
    "  require(path.join(__dirname, '..', 'cottoncord', 'injector', 'index.js'));",
    "} catch (err) {",
    "  console.error('[CottonCord] injector failed:', err.message);",
    "  // Fall back to the real Discord asar",
    "  const real = [",
    "    path.join(__dirname, '..', '_app.asar'),",
    "    path.join(__dirname, '..', 'app.asar.bak'),",
    "  ].find(p => { try { return fs.statSync(p).size > 10240; } catch(_){} });",
    "  if (real) require(real);",
    "}",
  ].join('\n');

  const asarBuf = buildMinimalAsar('index.js', loaderJs);
  fs.writeFileSync(appAsarPath, asarBuf);
}

function doUninstall(resourcesPath) {
  const appAsarPath = path.join(resourcesPath, 'app.asar');
  const backupPath  = path.join(resourcesPath, 'app.asar.bak');
  const ccDir       = path.join(resourcesPath, 'cottoncord');

  // Restore original app.asar
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, appAsarPath);
    fs.unlinkSync(backupPath);
  }

  // Remove CottonCord files
  rmDirSync(ccDir);
}

// ── IPC handlers ───────────────────────────────────────────────────────────

ipcMain.handle('get-info', () => {
  const resources = findDiscordResources();
  return {
    resourcesPath: resources,
    version:       readDiscordVersion(resources),
    installed:     resources ? isInstalled(resources) : false,
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
