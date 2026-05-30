'use strict';

const Module = require('module');
const path   = require('path');
const fs     = require('fs');

const PRELOAD_PATH = path.join(__dirname, 'preload.js');

const ASAR_PATH = process.resourcesPath
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'app.asar');

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

// ── VPN IPC handlers (main process only) ──────────────────────────────────
//
// session.defaultSession is a main-process-only API, so vpnManager.js (which
// runs in the preload/renderer) communicates here via ipcMain/ipcRenderer.
// Handlers are registered before Discord's asar loads so they're ready for
// the first IPC call that comes in from the preload.

const { ipcMain, app, session } = require('electron');

// Holds proxy credentials in memory so the 'login' event can answer
// Electron's SOCKS5 auth challenge without a round-trip to the renderer.
let _vpnCreds = null;

function buildDiscordPacScript(host, port) {
  // PAC script routes only Discord hostnames through the SOCKS5 proxy.
  // All other traffic returns DIRECT. ${host} and ${port} below are our
  // JS template-literal substitutions; the `host` parameter inside the
  // PAC function body is the PAC runtime's own variable — not a conflict.
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

ipcMain.handle('cc:vpn:setProxy', async (_event, config) => {
  try {
    _vpnCreds = config;
    await app.whenReady();
    await session.defaultSession.setProxy({
      pacScript: buildDiscordPacScript(config.host, config.port),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cc:vpn:clearProxy', async () => {
  try {
    _vpnCreds = null;
    await app.whenReady();
    // Empty object resets to system default (no proxy)
    await session.defaultSession.setProxy({});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Answer SOCKS5 authentication challenges on behalf of the renderer.
// This fires when the SOCKS5 server requires a username/password.
app.whenReady().then(() => {
  app.on('login', (event, _webContents, _request, authInfo, callback) => {
    if (authInfo.isProxy && _vpnCreds?.username) {
      event.preventDefault();
      callback(_vpnCreds.username, _vpnCreds.password ?? '');
    }
  });
});

// ── Load Discord ───────────────────────────────────────────────────────────

try {
  if (!fs.existsSync(ASAR_PATH)) throw new Error(`app.asar not found at: ${ASAR_PATH}`);
  require(ASAR_PATH);
} catch (err) {
  console.error('[CottonCord] FATAL: Failed to load Discord:', err.message);
}
