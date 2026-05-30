'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const React     = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');
const PluginCard = require('../components/PluginCard.jsx').default;
const StatusBadge = require('../components/StatusBadge.jsx').default;
const Toggle     = require('../components/Toggle.jsx').default;

const BD_DIR = path.join(__dirname, '..', '..', '..', 'plugins', 'bd');
const VC_DIR = path.join(__dirname, '..', '..', '..', 'plugins', 'vencord');
const CUSTOM_META_FILE = path.join(__dirname, '..', '..', '..', 'plugins', 'custom-meta.json');

const CATEGORIES = ['All', 'Appearance', 'Messaging', 'Utilities', 'Notifications'];

// ── Custom plugin metadata helpers ─────────────────────────────────────────

function readCustomMeta() {
  try { return JSON.parse(fs.readFileSync(CUSTOM_META_FILE, 'utf8')); } catch (_) { return []; }
}
function saveCustomMeta(meta) {
  try {
    fs.mkdirSync(path.dirname(CUSTOM_META_FILE), { recursive: true });
    fs.writeFileSync(CUSTOM_META_FILE, JSON.stringify(meta, null, 2));
  } catch (_) {}
}

// ── Preset Plugins sub-tab ─────────────────────────────────────────────────

function PresetPlugins() {
  const [category, setCategory] = React.useState('All');
  const registry = window.PluginRegistry?.getRegistry?.();
  const allPlugins = registry?.plugins ?? [];
  const filtered   = category === 'All' ? allPlugins
    : allPlugins.filter(p => (p.category ?? 'Utilities') === category);

  function handleToggle(name, enabled) {
    const plugin = allPlugins.find(p => p.name === name);
    if (!plugin) return;
    const loader = plugin.source === 'betterdiscord'
      ? window.BDPluginLoader : window.VencordPluginLoader;
    enabled ? loader?.enablePlugin?.(name) : loader?.disablePlugin?.(name);
  }

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '5px 12px', borderRadius: '16px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 500,
              background: category === cat ? '#5865f2' : '#2b2d31',
              color:      category === cat ? '#fff'    : '#949ba4',
            }}
          >{cat}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#6d6f78', fontSize: '14px' }}>
          {registry ? 'No plugins in this category.' : 'Plugin registry not loaded yet.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '10px' }}>
          {filtered.map(p => {
            const isEnabled = (() => {
              const loader = p.source === 'betterdiscord' ? window.BDPluginLoader : window.VencordPluginLoader;
              return loader?.getPlugins?.()?.find(lp => lp.name === p.name)?.enabled ?? false;
            })();
            return <PluginCard key={p.name} plugin={{ ...p, enabled: isEnabled }} onToggle={handleToggle} />;
          })}
        </div>
      )}
    </div>
  );
}

// ── Custom Plugins sub-tab ─────────────────────────────────────────────────

function CustomPlugins() {
  const [meta, setMeta]       = React.useState(readCustomMeta);
  const [url, setUrl]         = React.useState('');
  const [installing, setInstalling] = React.useState(false);
  const [dragOver, setDragOver]     = React.useState(false);

  function installFile(name, content, ext) {
    const dest = ext === '.ts' ? path.join(VC_DIR, name) : path.join(BD_DIR, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
    const entry = { name: path.basename(name, ext), file: dest, source: ext === '.ts' ? 'vencord' : 'betterdiscord', unverified: true };
    const next = [...meta.filter(m => m.name !== entry.name), entry];
    saveCustomMeta(next);
    setMeta(next);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    for (const file of e.dataTransfer.files) {
      if (!['.js', '.ts'].includes(path.extname(file.name))) continue;
      const reader = new FileReader();
      reader.onload = ev => installFile(file.name, ev.target.result, path.extname(file.name));
      reader.readAsText(file);
    }
  }

  async function handleInstallUrl() {
    if (!url.trim()) return;
    setInstalling(true);
    try {
      const content = await fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
      const name    = url.split('/').pop() || 'plugin.js';
      installFile(name, content, path.extname(name) || '.js');
      setUrl('');
    } catch (err) {
      alert(`Install failed: ${err.message}`);
    } finally { setInstalling(false); }
  }

  function removePlugin(name) {
    const entry = meta.find(m => m.name === name);
    if (entry) { try { fs.unlinkSync(entry.file); } catch (_) {} }
    const next = meta.filter(m => m.name !== name);
    saveCustomMeta(next);
    setMeta(next);
  }

  function togglePlugin(name, enabled) {
    const entry = meta.find(m => m.name === name);
    if (!entry) return;
    const loader = entry.source === 'vencord' ? window.VencordPluginLoader : window.BDPluginLoader;
    enabled ? loader?.enablePlugin?.(name) : loader?.disablePlugin?.(name);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#5865f2' : '#3d3f45'}`,
          borderRadius: '8px', padding: '28px', textAlign: 'center',
          color: '#6d6f78', fontSize: '14px', transition: 'border-color 0.15s',
          background: dragOver ? '#1e202480' : 'transparent',
        }}
      >
        Drop <strong>.js</strong> or <strong>.ts</strong> plugin files here
      </div>

      {/* URL installer */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="GitHub raw URL to .js / .ts plugin…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px',
            border: '1px solid #3d3f45', background: '#1e1f22',
            color: '#dbdee1', fontSize: '14px', outline: 'none',
          }}
        />
        <button
          onClick={handleInstallUrl}
          disabled={installing}
          style={{
            padding: '8px 16px', borderRadius: '4px', border: 'none',
            background: '#5865f2', color: '#fff', cursor: 'pointer',
            fontSize: '14px', fontWeight: 500,
            opacity: installing ? 0.6 : 1,
          }}
        >
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>

      {/* Installed custom plugins */}
      {meta.length === 0 ? (
        <p style={{ color: '#6d6f78', fontSize: '14px' }}>No custom plugins installed yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {meta.map(m => (
            <div key={m.name} style={{
              background: '#2b2d31', border: '1px solid #1e1f22', borderRadius: '8px',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ flex: 1, fontWeight: 600, color: '#f2f3f5', fontSize: '14px' }}>{m.name}</span>
              <StatusBadge status="unverified" />
              <Toggle enabled={true} onChange={v => togglePlugin(m.name, v)} />
              <button
                onClick={() => removePlugin(m.name)}
                style={{
                  padding: '4px 10px', borderRadius: '4px', border: 'none',
                  background: '#ed4245', color: '#fff', cursor: 'pointer', fontSize: '12px',
                }}
              >Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function PluginsTab() {
  const [subTab, setSubTab] = React.useState('preset');

  const tabStyle = active => ({
    padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 500,
    background: active ? '#5865f2' : 'transparent',
    color:      active ? '#fff'    : '#949ba4',
  });

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '860px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#f2f3f5' }}>Plugins</h2>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        <button style={tabStyle(subTab === 'preset')} onClick={() => setSubTab('preset')}>Preset Plugins</button>
        <button style={tabStyle(subTab === 'custom')} onClick={() => setSubTab('custom')}>Custom Plugins</button>
      </div>

      {subTab === 'preset' ? <PresetPlugins /> : <CustomPlugins />}
    </div>
  );
}
