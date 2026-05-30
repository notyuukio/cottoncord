'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');

const PRELOAD_PATH = path.join(__dirname, 'preload.js');

// process.resourcesPath is the Discord/resources/ directory in Electron context
const ASAR_PATH = process.resourcesPath
  ? path.join(process.resourcesPath, 'app.asar')
  : path.join(__dirname, '..', '..', '..', 'app.asar');

// Cached patched electron reference — ensures every require('electron') call
// sees the same patched object without creating a new Proxy each time
let patchedElectron = null;

const originalLoad = Module._load.bind(Module);

Module._load = function(request, parent, isMain) {
  const result = originalLoad(request, parent, isMain);

  if (request !== 'electron') return result;

  if (patchedElectron) return patchedElectron;

  const OriginalBrowserWindow = result.BrowserWindow;

  class CottonCordBrowserWindow extends OriginalBrowserWindow {
    constructor(options = {}) {
      const wp = options.webPreferences ?? {};
      const discordPreload = wp.preload;

      // Forward Discord's preload path to our preload via argv so it can
      // be chained after CottonCord finishes initializing
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
          // Required so BD plugins can access window.* from preload context
          contextIsolation: false,
          additionalArguments,
        },
      });
    }
  }

  // Carry over static methods (getAllWindows, fromId, etc.)
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

// Load Discord — app.asar becomes the actual Discord app once our hooks are in place
try {
  if (!fs.existsSync(ASAR_PATH)) {
    throw new Error(`app.asar not found at: ${ASAR_PATH}`);
  }
  require(ASAR_PATH);
} catch (err) {
  console.error('[CottonCord] FATAL: Failed to load Discord:', err.message);
}
