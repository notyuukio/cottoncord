'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { ipcRenderer } = require('electron');

// ── Config path ────────────────────────────────────────────────────────────
// Stored in the user's OS app-data folder, never inside the repo.

function getConfigPath() {
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
  return path.join(base, 'CottonCord', 'cottoncord-config.json');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function writeConfig(patch) {
  try {
    const configPath = getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    const existing = readConfig();
    fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...patch }, null, 2), 'utf8');
  } catch (err) {
    console.error('[CottonCord] VPN: failed to save config:', err.message);
  }
}

// ── Preset provider defaults ───────────────────────────────────────────────

const PROVIDERS = {
  protonvpn: { host: '127.0.0.1', port: 1080 }, // ProtonVPN local SOCKS5 proxy
  mullvad:   { host: '10.8.0.1',  port: 1080 }, // Mullvad local SOCKS5 proxy
  custom:    { host: '',          port: 1080 },
};

// ── In-memory state ────────────────────────────────────────────────────────
// IPs are never written to the console (see technical rules).

const state = {
  connected: false,
  provider:  'custom',
  realIP:    '',
  maskedIP:  '',
  config:    null,   // { host, port, username, password }
};

// ── IP fetching ────────────────────────────────────────────────────────────

function fetchIP(agent = null) {
  return new Promise((resolve, reject) => {
    const req = https.get('https://api.ipify.org', agent ? { agent } : {}, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('timeout')); });
  });
}

async function fetchMaskedIP(config) {
  const { SocksProxyAgent } = require('socks-proxy-agent');
  const auth = (config.username && config.password)
    ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
    : '';
  const proxyUrl = `socks5://${auth}${config.host}:${config.port}`;
  const agent = new SocksProxyAgent(proxyUrl);
  return fetchIP(agent);
}

// ── Core VPN operations ────────────────────────────────────────────────────

async function connect() {
  if (!state.config) throw new Error('No VPN config — call configure() first');

  // Capture real IP before routing changes. Not logged, only stored.
  try {
    state.realIP = await fetchIP();
  } catch (_) {
    state.realIP = 'unavailable';
  }

  // Ask the main process to set the PAC-based session proxy
  const result = await ipcRenderer.invoke('cc:vpn:setProxy', state.config);

  if (!result.ok) {
    // Kill switch is still armed in the main process — Discord traffic stays
    // blocked. Show a native blocking dialog so the user understands why
    // Discord is not loading and what to do. Do NOT fall back to direct.
    const errMsg =
      `CottonCord could not activate the SOCKS5 proxy:\n\n` +
      `${result.error ?? 'Unknown error'}\n\n` +
      `Discord traffic is blocked to protect your IP address.\n` +
      `Fix your VPN settings in CottonCord → IP Protection, then restart Discord.`;

    // Fire-and-forget — dialog is blocking in the main process so this
    // promise resolves only after the user closes the dialog.
    ipcRenderer.invoke('cc:vpn:showError', 'CottonCord — Kill Switch Active', errMsg)
      .catch(() => {});

    throw new Error(result.error ?? 'setProxy failed');
  }

  // Verify the proxy is working and capture masked IP
  try {
    state.maskedIP = await fetchMaskedIP(state.config);
  } catch (_) {
    state.maskedIP = 'unavailable';
  }

  state.connected = true;

  // Persist enabled state (never persist the raw IPs)
  writeConfig({ vpn: { enabled: true, provider: state.provider, ...state.config } });

  console.log('[CottonCord] VPN: connected via', state.provider);
}

async function disconnect() {
  const result = await ipcRenderer.invoke('cc:vpn:clearProxy');
  if (!result.ok) console.error('[CottonCord] VPN: clearProxy error:', result.error);

  state.connected = false;
  state.maskedIP  = '';

  writeConfig({ vpn: { enabled: false, provider: state.provider, ...state.config } });

  console.log('[CottonCord] VPN: disconnected');
}

function configure(provider, host, port, username, password) {
  const preset = PROVIDERS[provider] ?? PROVIDERS.custom;
  state.provider = provider ?? 'custom';
  state.config = {
    host:     host     ?? preset.host,
    port:     port     ?? preset.port,
    username: username ?? '',
    password: password ?? '',
  };
  writeConfig({ vpn: { enabled: false, provider: state.provider, ...state.config } });
}

function getStatus() {
  return {
    connected: state.connected,
    realIP:    state.realIP,
    maskedIP:  state.maskedIP,
    provider:  state.provider,
  };
}

// ── Auto-connect on startup ────────────────────────────────────────────────

async function loadSavedConfig() {
  try {
    const saved = readConfig();
    const vpn   = saved?.vpn;
    if (!vpn) return;

    configure(vpn.provider, vpn.host, vpn.port, vpn.username, vpn.password);

    if (vpn.enabled) {
      console.log('[CottonCord] VPN: auto-connecting from saved session...');
      await connect();
    }
  } catch (err) {
    console.error('[CottonCord] VPN: auto-connect failed:', err.message);
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────

loadSavedConfig().catch(err =>
  console.error('[CottonCord] VPN: init error:', err.message)
);

window.CottonCordVPN = { configure, connect, disconnect, getStatus, loadSavedConfig };

module.exports = {
  configure,
  connect,
  disconnect,
  getStatus,
  loadSavedConfig,
};
