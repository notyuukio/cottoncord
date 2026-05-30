# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What CottonCord is

A Discord Electron client mod that injects itself before Discord loads, intercepts Discord's internal webpack module system, and runs plugins from both BetterDiscord and Vencord simultaneously without conflicts.

## Commands

```bash
npm install          # install deps (esbuild, electron, socks-proxy-agent)
npm run build        # compile src/ → dist/ via esbuild (node build.js)
```

There are no tests yet. The build script (`build.js`) uses esbuild with `bundle: false` — it transpiles each file individually, does not bundle them into one artifact.

The installer app has its own separate `package.json` inside `installer/`. Build it with `npm ci && npm run build:win|mac|linux` from that directory.

Releases are triggered by pushing a `v*` tag — GitHub Actions builds all three platform installers automatically via `.github/workflows/release.yml`.

## How injection works

CottonCord works by placing an `app/` folder next to Discord's `app.asar`. Electron prefers `app/` over `app.asar` when both exist, so `app/index.js` becomes the real entry point.

```
Discord/resources/
├── app.asar          ← original Discord (untouched)
└── app/
    ├── package.json  ← { "main": "index.js" }
    ├── index.js      ← thin shim, loads src/injector/index.js
    └── src/          ← CottonCord source, copied here by installer
```

`src/injector/index.js` (main process) patches `Module._load` globally so that when Discord's code calls `require('electron')` it gets a Proxy with a subclassed `BrowserWindow`. That subclass injects `src/injector/preload.js` into every window Discord creates and forwards Discord's original preload path via `--cc-preload=<path>` argv flag.

`src/injector/preload.js` (renderer process) runs before Discord's page. It loads all eight core modules in order, each in a `try/catch`, then chains Discord's original preload at the very end via the argv flag. It also exposes `window.CottonCord`.

## Module load order (preload.js)

1. `src/core/moduleStore.js` — webpack interception
2. `src/core/patcher.js` — function patching
3. `src/loaders/bdLoader.js` — BetterDiscord plugin loader
4. `src/loaders/vencordLoader.js` — Vencord plugin loader
5. `src/protection/vpnManager.js` — SOCKS5 split tunnel
6. `src/ui/settingsPanel.jsx` — Discord settings injection
7. `src/updater/autoUpdater.js` — GitHub release updater
8. `src/updater/pluginRegistry.js` — plugin registry sync

Each module must export `getModuleCount?.()`, `getLoadedCount?.()`, `getPlugins?.()`, `getStatus?.()` etc. as optional methods — preload.js uses optional chaining so stubs with `module.exports = {}` work fine.

## Technical rules (never break)

- Every module loads inside `try/catch` — one failure must never crash the rest
- Never hardcode webpack module IDs — always use fuzzy string matching
- Never write transpiled TypeScript to disk — in-memory only (Vencord loader uses esbuild transform API)
- Never log the user's real IP anywhere
- Never modify `app.asar` — only ever add the `app/` folder
- All patches must stack correctly when multiple plugins patch the same method
- IP protection routes only `discord.com`, `discordapp.com`, and `gateway.discord.gg` through the proxy

## plugin-registry.json schema

```json
{
  "version": "1.0.0",
  "plugins": [
    {
      "id": "plugin-id",
      "name": "Display Name",
      "source": "bd" | "vencord",
      "version": "1.0.0",
      "url": "https://...",
      "broken": false,
      "conflicts": []
    }
  ]
}
```

Fetched from GitHub on every startup by `pluginRegistry.js`. Plugins marked `broken: true` are auto-disabled with a toast. Outdated versions are auto-updated.

## Settings UI architecture

`src/ui/settingsPanel.jsx` injects a CottonCord section into Discord's settings sidebar. It renders tabs using Discord's own React components (found via webpack module store). Tabs live in `src/ui/tabs/`, shared components in `src/ui/components/`.

`.jsx` files are loaded via `require()` with a registered extension handler (`Module._extensions['.jsx'] = Module._extensions['.js']`) — they are plain JS/JSX that Discord's React renders, not pre-compiled.

## BD plugin compatibility requirements

`contextIsolation: false` and `sandbox: false` are set on every BrowserWindow so that BetterDiscord plugins can access `window.*` from the preload context. Do not change these without understanding the BD plugin surface.

## Branch convention

All development happens on `claude/kind-cannon-CYN6h`. Push after every completed prompt with `git push -u origin claude/kind-cannon-CYN6h`.
