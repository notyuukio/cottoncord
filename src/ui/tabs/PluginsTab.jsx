'use strict';

const fs   = require('fs');
const path = require('path');
const React     = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');
const Toggle    = require('../components/Toggle.jsx').default;
const StatusBadge = require('../components/StatusBadge.jsx').default;

const BD_DIR           = path.join(__dirname, '..', '..', '..', 'plugins', 'bd');
const VC_DIR           = path.join(__dirname, '..', '..', '..', 'plugins', 'vencord');
const CUSTOM_META_FILE = path.join(__dirname, '..', '..', '..', 'plugins', 'custom-meta.json');

const ALL_TAGS = [
  'Accessibility', 'Activity', 'Appearance', 'Chat', 'Commands',
  'Context Menu', 'Fun', 'Messaging', 'Notifications', 'Privacy',
  'Utilities', 'Voice', 'Other',
];

const STATUS_OPTIONS = ['Show All', 'Enabled Only', 'Disabled Only', 'Broken'];

// ── Shared helpers ─────────────────────────────────────────────────────────

function readCustomMeta() {
  try { return JSON.parse(fs.readFileSync(CUSTOM_META_FILE, 'utf8')); } catch (_) { return []; }
}
function saveCustomMeta(meta) {
  try {
    fs.mkdirSync(path.dirname(CUSTOM_META_FILE), { recursive: true });
    fs.writeFileSync(CUSTOM_META_FILE, JSON.stringify(meta, null, 2));
  } catch (_) {}
}

function getLoaderPlugins(source) {
  if (source === 'bd')      return window.BDPluginLoader?.getPlugins?.()      ?? [];
  if (source === 'vencord') return window.VencordPluginLoader?.getPlugins?.() ?? [];
  return [];
}

// ── Shared filter bar ──────────────────────────────────────────────────────

function FilterBar({ search, onSearch, status, onStatus, tags, onTagToggle }) {
  const [tagsOpen, setTagsOpen] = React.useState(false);

  const activeTagCount = tags.length;
  const tagLabel = activeTagCount === 0
    ? 'Filter by Tags'
    : `${activeTagCount} Tag${activeTagCount > 1 ? 's' : ''} selected`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          color: '#6d6f78', fontSize: '15px', pointerEvents: 'none',
        }}>🔍</span>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search for a plugin..."
          style={{
            width: '100%', padding: '9px 12px 9px 32px', boxSizing: 'border-box',
            borderRadius: '4px', border: '1px solid #3d3f45',
            background: '#1e1f22', color: '#dbdee1', fontSize: '14px', outline: 'none',
          }}
        />
      </div>

      {/* Dropdowns row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Status dropdown */}
        <select
          value={status}
          onChange={e => onStatus(e.target.value)}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '4px',
            border: '1px solid #3d3f45', background: '#1e1f22',
            color: '#dbdee1', fontSize: '14px', outline: 'none', cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Tags multi-select — custom popover */}
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => setTagsOpen(o => !o)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: '4px',
              border: '1px solid #3d3f45', background: '#1e1f22',
              color: activeTagCount > 0 ? '#dbdee1' : '#6d6f78',
              fontSize: '14px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span>{tagLabel}</span>
            <span style={{ fontSize: '10px', color: '#6d6f78' }}>{tagsOpen ? '▲' : '▼'}</span>
          </button>

          {tagsOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#2b2d31', border: '1px solid #3d3f45', borderRadius: '6px',
              padding: '6px 0', zIndex: 100,
              maxHeight: '260px', overflowY: 'auto',
              boxShadow: '0 4px 16px rgba(0,0,0,.5)',
            }}>
              {ALL_TAGS.map(tag => (
                <label
                  key={tag}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', cursor: 'pointer',
                    fontSize: '14px', color: '#dbdee1',
                    background: tags.includes(tag) ? '#35373c' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!tags.includes(tag)) e.currentTarget.style.background = '#35373c'; }}
                  onMouseLeave={e => { if (!tags.includes(tag)) e.currentTarget.style.background = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={tags.includes(tag)}
                    onChange={() => onTagToggle(tag)}
                    style={{ accentColor: '#5865f2', cursor: 'pointer' }}
                  />
                  {tag}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Plugin row card (vertical list style, like Vencord) ────────────────────

function PluginRow({ plugin, enabled, onToggle }) {
  const hasSettings = !!(plugin.settings);
  const status = plugin.broken ? 'broken' : enabled ? 'working' : 'disabled';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px',
      background: '#2b2d31', borderRadius: '8px',
      border: '1px solid #1e1f22',
    }}>
      {/* Left: name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <span style={{ fontWeight: 700, color: '#f2f3f5', fontSize: '15px' }}>
            {plugin.name}
          </span>
          {plugin.broken && <StatusBadge status="broken" />}
          {plugin.unverified && <StatusBadge status="unverified" />}
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#949ba4', lineHeight: '1.4',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plugin.description || 'No description provided.'}
        </p>
      </div>

      {/* Right: icon + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Gear icon if has settings, info icon otherwise */}
        <span
          title={hasSettings ? 'This plugin has settings' : 'No settings'}
          style={{ fontSize: '16px', cursor: hasSettings ? 'pointer' : 'default',
                   color: hasSettings ? '#b5bac1' : '#4f545c',
                   userSelect: 'none' }}
        >
          {hasSettings ? '⚙️' : 'ℹ️'}
        </span>

        <Toggle
          enabled={enabled}
          disabled={plugin.broken}
          onChange={v => onToggle(plugin.name, v)}
        />
      </div>
    </div>
  );
}

// ── Plugin list with filters ───────────────────────────────────────────────

function PluginList({ plugins, source, extra = {} }) {
  const [search,  setSearch]  = React.useState('');
  const [status,  setStatus]  = React.useState('Show All');
  const [tags,    setTags]    = React.useState([]);
  const [enabled, setEnabled] = React.useState(() => {
    const map = {};
    plugins.forEach(p => { map[p.name] = p.enabled ?? true; });
    return map;
  });

  function togglePlugin(name, val) {
    setEnabled(prev => ({ ...prev, [name]: val }));
    const loader = source === 'bd'
      ? window.BDPluginLoader
      : source === 'vencord'
        ? window.VencordPluginLoader
        : null;
    if (loader) {
      val ? loader.enablePlugin?.(name) : loader.disablePlugin?.(name);
    } else if (extra.onToggle) {
      extra.onToggle(name, val);
    }
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  // Apply all three filters simultaneously
  const visible = plugins.filter(p => {
    const isEnabled = enabled[p.name] ?? true;

    // Status filter
    if (status === 'Enabled Only'  && !isEnabled)    return false;
    if (status === 'Disabled Only' && isEnabled)     return false;
    if (status === 'Broken'        && !p.broken)     return false;

    // Tag filter (match ANY checked tag if any are checked)
    if (tags.length > 0) {
      const ptags = p.tags ?? p.category ? [p.category] : [];
      if (!tags.some(t => ptags.includes(t))) return false;
    }

    // Search filter (name + description)
    if (search.trim()) {
      const q = search.toLowerCase();
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = (p.description ?? '').toLowerCase().includes(q);
      if (!inName && !inDesc) return false;
    }

    return true;
  });

  return (
    <div>
      <FilterBar
        search={search}   onSearch={setSearch}
        status={status}   onStatus={setStatus}
        tags={tags}       onTagToggle={toggleTag}
      />

      {/* Results count */}
      <div style={{ fontSize: '12px', color: '#6d6f78', marginBottom: '10px' }}>
        Showing {visible.length} of {plugins.length} plugin{plugins.length !== 1 ? 's' : ''}
      </div>

      {/* Section header */}
      <div style={{
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#949ba4', marginBottom: '8px',
      }}>
        Plugins
      </div>

      {/* Vertical list */}
      {visible.length === 0 ? (
        <p style={{ color: '#6d6f78', fontSize: '14px', padding: '16px 0' }}>
          No plugins match your filters.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visible.map(p => (
            <PluginRow
              key={p.name}
              plugin={p}
              enabled={enabled[p.name] ?? (p.enabled ?? true)}
              onToggle={togglePlugin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom plugins (install + manage) ─────────────────────────────────────

function CustomTab() {
  const [meta,      setMeta]      = React.useState(readCustomMeta);
  const [url,       setUrl]       = React.useState('');
  const [installing,setInstalling]= React.useState(false);
  const [dragOver,  setDragOver]  = React.useState(false);

  function installFile(name, content, ext) {
    const dest  = ext === '.ts' ? path.join(VC_DIR, name) : path.join(BD_DIR, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, 'utf8');
    const src   = ext === '.ts' ? 'vencord' : 'betterdiscord';
    const entry = { name: path.basename(name, ext), file: dest, source: src, unverified: true, enabled: true };
    const next  = [...meta.filter(m => m.name !== entry.name), entry];
    saveCustomMeta(next);
    setMeta(next);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    for (const file of e.dataTransfer.files) {
      const ext = path.extname(file.name);
      if (!['.js', '.ts'].includes(ext)) continue;
      const reader = new FileReader();
      reader.onload = ev => installFile(file.name, ev.target.result, ext);
      reader.readAsText(file);
    }
  }

  async function handleInstallUrl() {
    if (!url.trim()) return;
    setInstalling(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const content = await resp.text();
      const name    = url.split('/').pop() || 'plugin.js';
      installFile(name, content, path.extname(name) || '.js');
      setUrl('');
    } catch (err) { alert(`Install failed: ${err.message}`); }
    finally { setInstalling(false); }
  }

  function removePlugin(name) {
    const entry = meta.find(m => m.name === name);
    if (entry) { try { fs.unlinkSync(entry.file); } catch (_) {} }
    const next = meta.filter(m => m.name !== name);
    saveCustomMeta(next); setMeta(next);
  }

  // Build a plugin-list-compatible array from meta
  const customPlugins = meta.map(m => ({
    name:        m.name,
    description: m.description ?? 'Unverified custom plugin',
    source:      m.source,
    enabled:     m.enabled ?? true,
    unverified:  true,
    tags:        [],
  }));

  function handleToggle(name, val) {
    const entry = meta.find(m => m.name === name);
    if (!entry) return;
    const loader = entry.source === 'vencord' ? window.VencordPluginLoader : window.BDPluginLoader;
    val ? loader?.enablePlugin?.(name) : loader?.disablePlugin?.(name);
    const next = meta.map(m => m.name === name ? { ...m, enabled: val } : m);
    saveCustomMeta(next); setMeta(next);
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
          borderRadius: '8px', padding: '24px', textAlign: 'center',
          color: '#6d6f78', fontSize: '14px', transition: 'border-color 0.15s',
          background: dragOver ? '#1e202450' : 'transparent',
        }}
      >
        Drop <strong>.js</strong> or <strong>.ts</strong> files here to install
      </div>

      {/* URL installer */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={url} onChange={e => setUrl(e.target.value)}
          placeholder="GitHub raw URL to .js / .ts plugin…"
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '4px',
            border: '1px solid #3d3f45', background: '#1e1f22',
            color: '#dbdee1', fontSize: '14px', outline: 'none',
          }}
        />
        <button
          onClick={handleInstallUrl} disabled={installing}
          style={{
            padding: '8px 16px', borderRadius: '4px', border: 'none',
            background: '#5865f2', color: '#fff', cursor: 'pointer',
            fontSize: '14px', fontWeight: 500, opacity: installing ? 0.6 : 1,
          }}
        >
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>

      {/* List with shared filter bar */}
      {customPlugins.length > 0 && (
        <PluginList
          plugins={customPlugins}
          source={null}
          extra={{ onToggle: handleToggle }}
        />
      )}

      {/* Remove buttons rendered outside PluginList to preserve existing logic */}
      {customPlugins.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '-8px' }}>
          {meta.map(m => (
            <div key={m.name} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => removePlugin(m.name)}
                style={{
                  padding: '3px 10px', borderRadius: '4px', border: 'none',
                  background: '#ed4245', color: '#fff', cursor: 'pointer', fontSize: '11px',
                }}
              >Remove {m.name}</button>
            </div>
          ))}
        </div>
      )}

      {customPlugins.length === 0 && (
        <p style={{ color: '#6d6f78', fontSize: '14px' }}>No custom plugins installed yet.</p>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function PluginsTab() {
  const [platform, setPlatform] = React.useState('bd');

  const bdPlugins  = getLoaderPlugins('bd');
  const vcPlugins  = getLoaderPlugins('vencord');

  function platformPlugins() {
    if (platform === 'bd')      return bdPlugins;
    if (platform === 'vencord') return vcPlugins;
    return [];
  }

  const tabs = [
    { id: 'bd',      label: 'BetterDiscord', count: bdPlugins.length,  badgeColor: '#23a55a' },
    { id: 'vencord', label: 'Vencord',       count: vcPlugins.length,  badgeColor: '#5865f2' },
    { id: 'custom',  label: 'Custom',        count: readCustomMeta().length, badgeColor: '#4f545c', warn: true },
  ];

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '760px' }}>

      {/* Platform tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px',
                    borderBottom: '1px solid #3d3f45', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setPlatform(t.id)}
            style={{
              padding: '8px 16px', borderRadius: '4px 4px 0 0', border: 'none',
              cursor: 'pointer', fontSize: '14px', fontWeight: 500,
              background: platform === t.id ? '#2b2d31' : 'transparent',
              color:      platform === t.id ? '#f2f3f5' : '#949ba4',
              borderBottom: platform === t.id ? '2px solid #5865f2' : '2px solid transparent',
              marginBottom: '-1px',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}
          >
            {t.warn && <span title="Unverified plugins" style={{ fontSize: '13px' }}>⚠️</span>}
            {t.label}
            <span style={{
              background: t.badgeColor, color: '#fff',
              borderRadius: '10px', padding: '1px 7px',
              fontSize: '11px', fontWeight: 700, minWidth: '18px', textAlign: 'center',
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {platform === 'custom' ? (
        <CustomTab />
      ) : (
        <PluginList plugins={platformPlugins()} source={platform} />
      )}
    </div>
  );
}
