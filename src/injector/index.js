'use strict';

const Module = require('module');
const path   = require('path');
const fs     = require('fs');

const PRELOAD_PATH = path.join(__dirname, 'preload.js');

// Newer Discord versions use _app.asar as the real app; app.asar is a 1 KB stub.
// Prefer _app.asar when present, fall back to app.asar for older installs.
function resolveAsarPath() {
  const base = process.resourcesPath || path.join(__dirname, '..', '..', '..');
  const candidates = [
    path.join(base, '_app.asar'),
    path.join(base, 'app.asar'),
  ];
  return candidates.find(p => {
    try { return fs.statSync(p).size > 10240; } catch (_) { return false; }
  }) ?? candidates[1];
}
const ASAR_PATH = resolveAsarPath();

// ── BrowserWindow patch ────────────────────────────────────────────────────

let patchedElectron = null;
const originalLoad  = Module._load.bind(Module);

Module._load = function(request, parent, isMain) {
  const result = originalLoad(request, parent, isMain);
  if (request !== 'electron') return result;
  if (patchedElectron) return patchedElectron;

  const OriginalBrowserWindow = result.BrowserWindow;

  class CottonCordBrowserWindow extends OriginalBrowserWindow {
    constructor(options = {}) {
      const wp = options.webPreferences ?? {};
      const discordPreload = wp.preload;

      const additionalArguments = [...(wp.additionalArguments ?? [])];
      if (discordPreload) {
        additionalArguments.push(`--cc-preload=${discordPreload}`);
      }

      super({
        ...options,
        webPreferences: {
          ...wp,
          preload: PRELOAD_PATH,
          sandbox: false,
          contextIsolation: false,
          additionalArguments,
        },
      });
    }
  }

  Object.assign(CottonCordBrowserWindow, OriginalBrowserWindow);
  Object.setPrototypeOf(CottonCordBrowserWindow, OriginalBrowserWindow);

  patchedElectron = new Proxy(result, {
    get(target, prop) {
      if (prop === 'BrowserWindow') return CottonCordBrowserWindow;
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return patchedElectron;
};

// ── VPN / kill-switch helpers ──────────────────────────────────────────────

const { ipcMain, app, session, dialog } = require('electron');

let _vpnCreds       = null;
let killSwitchArmed = false;   // true = block all Discord requests

// Discord URL patterns for webRequest filtering.
// Covers all hostnames protected by the technical rules.
const DISCORD_URL_PATTERNS = [
  '*://discord.com/*',
  '*://*.discord.com/*',
  '*://discordapp.com/*',
  '*://*.discordapp.com/*',
  '*://gateway.discord.gg/*',
];

function buildDiscordPacScript(host, port) {
  const proxy = `SOCKS5 ${host}:${port}`;
  return `function FindProxyForURL(url, host) {
  if (dnsDomainIs(host, ".discord.com")   ||
      dnsDomainIs(host, ".discordapp.com") ||
      host === "discord.com"               ||
      host === "discordapp.com"            ||
      host === "gateway.discord.gg") {
    return "${proxy}";
  }
  return "DIRECT";
}`;
}

// Read only the vpn.enabled flag from the persisted config.
// Duplicates the path logic from vpnManager so the main process is self-contained.
function savedVpnEnabled() {
  try {
    let base;
    if (process.platform === 'win32') {
      base = process.env.APPDATA
        || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    } else if (process.platform === 'darwin') {
      base = path.join(process.env.HOME || '', 'Library', 'Application Support');
    } else {
      base = process.env.XDG_CONFIG_HOME
        || path.join(process.env.HOME || '', '.config');
    }
    const raw = fs.readFileSync(
      path.join(base, 'CottonCord', 'cottoncord-config.json'), 'utf8'
    );
    return JSON.parse(raw)?.vpn?.enabled === true;
  } catch (_) {
    return false;
  }
}

// ── Kill switch ────────────────────────────────────────────────────────────
//
// Installed once in app.whenReady(). A single webRequest listener is registered
// for all Discord URL patterns. Whether it cancels the request is controlled
// by the killSwitchArmed flag, which starts true when VPN was enabled in the
// last session and is only set false after setProxy succeeds.
//
// Using a flag rather than re-registering the listener avoids the "last
// listener wins" behaviour of onBeforeRequest — we never need to re-install.

app.whenReady().then(() => {
  if (savedVpnEnabled()) {
    killSwitchArmed = true;
    console.log('[CottonCord] Kill switch: ARMED — Discord traffic blocked until proxy confirmed');

    session.defaultSession.webRequest.onBeforeRequest(
      { urls: DISCORD_URL_PATTERNS },
      (details, callback) => {
        // Dynamically read the flag — no listener re-registration needed
        callback({ cancel: killSwitchArmed });
      }
    );
  }

  // Answer SOCKS5 authentication challenges raised by Electron's network stack
  app.on('login', (event, _webContents, _request, authInfo, callback) => {
    if (authInfo.isProxy && _vpnCreds?.username) {
      event.preventDefault();
      callback(_vpnCreds.username, _vpnCreds.password ?? '');
    }
  });
});

// ── VPN IPC handlers ───────────────────────────────────────────────────────

ipcMain.handle('cc:vpn:setProxy', async (_event, config) => {
  try {
    _vpnCreds = config;
    await app.whenReady();
    await session.defaultSession.setProxy({
      pacScript: buildDiscordPacScript(config.host, config.port),
    });

    // setProxy resolved → proxy is active. Disarm the kill switch.
    // JS is single-threaded in the main process; no request can slip
    // through between setProxy completing and the flag being cleared.
    killSwitchArmed = false;
    console.log('[CottonCord] Kill switch: disarmed — proxy active');
    return { ok: true };
  } catch (err) {
    // Kill switch stays armed. Return the error so vpnManager can surface it.
    console.error('[CottonCord] Kill switch: proxy setup failed — traffic remains blocked');
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cc:vpn:clearProxy', async () => {
  try {
    _vpnCreds = null;
    await app.whenReady();
    await session.defaultSession.setProxy({});
    // Intentional user disconnect — kill switch is NOT re-armed here.
    // It only arms on startup when the saved config says enabled:true.
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Show a native blocking error dialog — used by vpnManager when the proxy
// fails while the kill switch is armed. Native dialog works regardless of
// Discord's page state since it doesn't touch the renderer DOM at all.
ipcMain.handle('cc:vpn:showError', async (_event, title, message) => {
  await app.whenReady();
  dialog.showErrorBox(title, message);
});

// ── Load Discord ───────────────────────────────────────────────────────────

try {
  if (!fs.existsSync(ASAR_PATH)) throw new Error(`app.asar not found at: ${ASAR_PATH}`);
  require(ASAR_PATH);
} catch (err) {
  console.error('[CottonCord] FATAL: Failed to load Discord:', err.message);
}
