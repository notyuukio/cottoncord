'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const os    = require('os');

const GITHUB_OWNER  = 'notyuukio';
const GITHUB_REPO   = 'cottoncord';
const RELEASE_URL   = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const STARTUP_DELAY = 5000; // ms — let Discord finish loading before we do anything

let lastChecked = null;

// ── Helpers ────────────────────────────────────────────────────────────────

function getCurrentVersion() {
  // Walk up from __dirname until we find a package.json with a version field.
  // Works in both the dev repo and after the installer copies files.
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.version) return pkg.version;
    } catch (_) {}
    dir = path.dirname(dir);
  }
  return '0.0.0';
}

function isNewer(remoteTag, currentVersion) {
  const parse = v => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = parse(remoteTag);
  const c = parse(currentVersion);
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

// Follow up to 5 redirects (GitHub asset downloads redirect to S3)
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          resolve(httpsGet(res.headers.location, headers));
        } else {
          resolve(res);
        }
      }
    ).on('error', reject);
  });
}

function readJson(res) {
  return new Promise((resolve, reject) => {
    let raw = '';
    res.on('data', chunk => { raw += chunk; });
    res.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    res.on('error', reject);
  });
}

function streamToFile(res, destPath) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    res.pipe(out);
    out.on('finish', () => out.close(resolve));
    out.on('error', reject);
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────
// Inline — avoids circular dependency on bdLoader's internal showToast.
// The 5 s delay guarantees document.body exists before this is ever called.

function showToast(message) {
  try {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:24px', 'z-index:9999',
      'background:#2f3136', 'color:#dcddde',
      'border-left:4px solid #7289da', 'border-radius:4px',
      'padding:10px 14px', 'font-size:14px', 'max-width:360px',
      'box-shadow:0 2px 8px rgba(0,0,0,.4)',
      'transition:opacity .3s ease', 'pointer-events:none',
    ].join(';');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, 5000);
  } catch (_) {}
}

// ── File replacement ───────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function applyUpdate(zipPath) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  const tmpDir = path.join(os.tmpdir(), `cc-update-${Date.now()}`);

  zip.extractAllTo(tmpDir, true);

  // GitHub releases wrap everything in a top-level dir (repo-tag/).
  // Find src/ whether it's at the root or one level down.
  let extractedSrc = path.join(tmpDir, 'src');
  if (!fs.existsSync(extractedSrc)) {
    const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
    const subDir  = entries.find(e => e.isDirectory());
    if (subDir) extractedSrc = path.join(tmpDir, subDir.name, 'src');
  }

  if (!fs.existsSync(extractedSrc)) {
    throw new Error('src/ not found in release zip');
  }

  // Install root is two levels above __dirname (…/app/src/updater → …/app/)
  const installRoot   = path.join(__dirname, '..', '..');
  const installedSrc  = path.join(installRoot, 'src');

  copyDirSync(extractedSrc, installedSrc);

  // Also replace package.json if the zip includes one
  const extractedPkg = path.join(path.dirname(extractedSrc), 'package.json');
  if (fs.existsSync(extractedPkg)) {
    fs.copyFileSync(extractedPkg, path.join(installRoot, 'package.json'));
  }

  // Clean up temp dir; non-fatal if it fails
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

// ── Core update flow ───────────────────────────────────────────────────────

async function checkForUpdates() {
  // Every failure path is silent — no user-visible error, no console output.
  try {
    lastChecked = Date.now();
    const currentVersion = getCurrentVersion();
    const ua = { 'User-Agent': `CottonCord/${currentVersion}`, 'Accept': 'application/vnd.github.v3+json' };

    const res  = await httpsGet(RELEASE_URL, ua);
    if (res.statusCode !== 200) return;

    const data = await readJson(res);
    const tag  = data?.tag_name;
    if (!tag || !isNewer(tag, currentVersion)) return;

    const assetUrl = data?.assets?.[0]?.browser_download_url;
    if (!assetUrl) return;

    const newVersion = tag.replace(/^v/, '');
    showToast(`CottonCord update available — downloading v${newVersion}`);

    // Download zip to a temp file
    const tmpZip  = path.join(os.tmpdir(), `cc-update-${Date.now()}.zip`);
    const dlRes   = await httpsGet(assetUrl, ua);
    if (dlRes.statusCode !== 200) return;

    await streamToFile(dlRes, tmpZip);
    applyUpdate(tmpZip);

    try { fs.unlinkSync(tmpZip); } catch (_) {}

    showToast(`Update complete — restart Discord to apply v${newVersion}`);
  } catch (_) {
    // Intentionally silent — network errors, bad zips, missing adm-zip, etc.
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

setTimeout(checkForUpdates, STARTUP_DELAY);

window.CottonCordUpdater = {
  checkForUpdates,
  getCurrentVersion,
  getLastChecked: () => lastChecked,
};

module.exports = {
  checkForUpdates,
  getCurrentVersion,
  getLastChecked: () => lastChecked,
};
