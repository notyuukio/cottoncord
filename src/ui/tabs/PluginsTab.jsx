'use strict';

const path  = require('path');
const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');
const Toggle    = require('../components/Toggle.jsx').default;
const StatusBadge = require('../components/StatusBadge.jsx').default;

const ALL_TAGS = [
  'Accessibility', 'Activity', 'Appearance', 'Chat', 'Commands',
  'Context Menu', 'Fun', 'Messaging', 'Notifications', 'Privacy',
  'Utilities', 'Voice', 'Other',
];

const STATUS_OPTIONS = ['Show All', 'Enabled Only', 'Disabled Only', 'Broken'];

// ── Shared helpers ─────────────────────────────────────────────────────────

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

// ── Custom plugins — install + manage ─────────────────────────────────────

const BADGE_COLORS = { betterdiscord: '#23a55a', vencord: '#5865f2' };
const BADGE_LABELS = { betterdiscord: 'BD', vencord: 'VC' };

function SourceBadge({ source }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: '3px',
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', lineHeight: '16px',
      background: BADGE_COLORS[source] ?? '#4f545c',
      color: '#fff',
    }}>
      {BADGE_LABELS[source] ?? source}
    </span>
  );
}

function UnverifiedBadge() {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: '3px',
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', lineHeight: '16px',
      background: '#f0b132', color: '#fff',
    }}>
      Unverified
    </span>
  );
}

function CustomPluginCard({ entry, onToggle, onRefresh, onRemove }) {
  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await onRefresh(entry.id); } finally { setRefreshing(false); }
  }

  const btnBase = {
    padding: '4px 10px', borderRadius: '4px', border: 'none',
    fontSize: '12px', fontWeight: 500, cursor: 'pointer',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '14px 16px', background: '#2b2d31', borderRadius: '8px',
      border: '1px solid #1e1f22',
    }}>
      {/* Info block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badges row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontWeight: 700, color: '#f2f3f5', fontSize: '15px' }}>
            {entry.name}
          </span>
          <SourceBadge source={entry.source} />
          <UnverifiedBadge />
          {entry.broken && (
            <span style={{ padding: '2px 6px', borderRadius: '3px', fontSize: '10px',
                           fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                           background: '#ed4245', color: '#fff' }}>Broken</span>
          )}
        </div>

        {/* Author + version */}
        <div style={{ fontSize: '12px', color: '#72767d', marginBottom: '4px' }}>
          {entry.author !== 'Unknown' && <span>by <strong style={{ color: '#949ba4' }}>{entry.author}</strong></span>}
          {entry.author !== 'Unknown' && entry.version !== '0.0.0' && <span>  ·  </span>}
          {entry.version !== '0.0.0' && <span>v{entry.version}</span>}
        </div>

        {/* Description */}
        {entry.description && (
          <p style={{ margin: 0, fontSize: '13px', color: '#949ba4', lineHeight: '1.4',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.description}
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
        <Toggle
          enabled={entry.enabled && !entry.broken}
          disabled={!!entry.broken}
          onChange={v => onToggle(entry.id, v)}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {entry.sourceUrl && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Re-download from original URL"
              style={{ ...btnBase, background: '#35373c', color: refreshing ? '#6d6f78' : '#dbdee1' }}
            >
              {refreshing ? '↻ …' : '↻ Update'}
            </button>
          )}
          <button
            onClick={() => onRemove(entry.id, entry.name)}
            title="Remove plugin"
            style={{ ...btnBase, background: '#3a1c1d', color: '#ed4245' }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomTab() {
  const [plugins,    setPlugins]    = React.useState(() => window.CCCustomPlugins?.getMeta?.() ?? []);
  const [url,        setUrl]        = React.useState('');
  const [urlBusy,    setUrlBusy]    = React.useState(false);
  const [urlError,   setUrlError]   = React.useState('');
  const [dragOver,   setDragOver]   = React.useState(false);
  const [dropError,  setDropError]  = React.useState('');
  const fileInputRef = React.useRef(null);

  const refresh = () => setPlugins(window.CCCustomPlugins?.getMeta?.() ?? []);

  // ── process a File object (drop or browse) ─────────────────────────────
  async function processFile(file) {
    setDropError('');
    const ext = path.extname(file.name).toLowerCase();
    const mgr = window.CCCustomPlugins;
    if (!mgr) { setDropError('Plugin manager not ready — please wait a moment and try again'); return; }

    if (ext === '.zip') {
      const buf    = await file.arrayBuffer();
      const result = await mgr.installZip(buf, file.name);
      if (result.ok) { mgr.showToast(`${result.entry.name} installed and loaded successfully`, 'success'); refresh(); }
      else            { setDropError(result.reason); mgr.showToast(result.reason, 'error'); }
      return;
    }

    if (!['.js', '.ts'].includes(ext)) {
      setDropError('Only .js, .ts, and .zip files are supported');
      return;
    }

    const text   = await file.text();
    const result = await mgr.installPlugin(text, file.name, null);
    if (result.ok) { mgr.showToast(`${result.entry.name} installed and loaded successfully`, 'success'); refresh(); }
    else            { setDropError(result.reason); mgr.showToast(result.reason, 'error'); }
  }

  // ── drag and drop ──────────────────────────────────────────────────────
  function handleDragOver(e) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave()  { setDragOver(false); }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  }

  // ── browse files ───────────────────────────────────────────────────────
  function handleBrowse() { fileInputRef.current?.click(); }
  function handleFileChange(e) {
    Array.from(e.target.files ?? []).forEach(processFile);
    e.target.value = '';
  }

  // ── GitHub URL install ─────────────────────────────────────────────────
  async function handleInstallUrl() {
    const raw = url.trim();
    if (!raw) return;
    const mgr = window.CCCustomPlugins;
    if (!mgr) return;

    setUrlBusy(true); setUrlError('');
    try {
      let resolvedUrl = raw;
      const isRepo = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(raw);
      if (isRepo) {
        resolvedUrl = await mgr.resolveRepoUrl(raw);
        if (!resolvedUrl) throw new Error('Could not find a plugin file in that repository — make sure it has index.ts, index.js, plugin.ts, or plugin.js in the root');
      } else {
        resolvedUrl = mgr.normalizeGitHubUrl(raw);
      }

      const resp = await fetch(resolvedUrl);
      if (!resp.ok) throw new Error(`Could not download from that URL — check the link and try again (HTTP ${resp.status})`);
      const content  = await resp.text();
      const filename = resolvedUrl.split('/').pop() || 'plugin.js';
      const result   = await mgr.installPlugin(content, filename, raw);

      if (!result.ok) throw new Error(result.reason);
      mgr.showToast(`${result.entry.name} installed and loaded successfully`, 'success');
      setUrl('');
      refresh();
    } catch (err) {
      const msg = err.message || 'Could not download from that URL — check the link and try again';
      setUrlError(msg);
      mgr.showToast(msg, 'error');
    } finally {
      setUrlBusy(false);
    }
  }

  function handleUrlKeyDown(e) { if (e.key === 'Enter') handleInstallUrl(); }

  // ── card actions ───────────────────────────────────────────────────────
  async function handleRefresh(id) {
    const result = await window.CCCustomPlugins?.refreshPlugin?.(id);
    if (!result) return;
    if (result.ok) window.CCCustomPlugins.showToast('Plugin updated successfully', 'success');
    else           window.CCCustomPlugins.showToast(result.reason, 'error');
    refresh();
  }

  function handleRemove(id, name) {
    window.CCCustomPlugins?.uninstallPlugin?.(id);
    window.CCCustomPlugins?.showToast?.(`${name} removed`, 'info');
    refresh();
  }

  function handleToggle(id, val) {
    if (val) window.CCCustomPlugins?.enablePlugin?.(id);
    else     window.CCCustomPlugins?.disablePlugin?.(id);
    refresh();
  }

  // ── styles ─────────────────────────────────────────────────────────────
  const inputStyle = {
    flex: 1, padding: '9px 12px', borderRadius: '4px',
    border: `1px solid ${urlError ? '#ed4245' : '#3d3f45'}`,
    background: '#1e1f22', color: '#dbdee1', fontSize: '14px', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Drop zone + Browse ──────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#949ba4', marginBottom: '8px' }}>
          Install from File
        </div>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#5865f2' : dropError ? '#ed4245' : '#3d3f45'}`,
            borderRadius: '8px', padding: '28px 20px', textAlign: 'center',
            color: dragOver ? '#5865f2' : '#6d6f78', fontSize: '14px',
            transition: 'all 0.15s',
            background: dragOver ? 'rgba(88,101,242,0.07)' : 'transparent',
            cursor: 'default',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px', lineHeight: 1 }}>📂</div>
          <div>
            Drag and drop <strong style={{ color: '#dbdee1' }}>.js</strong>,{' '}
            <strong style={{ color: '#dbdee1' }}>.ts</strong>, or{' '}
            <strong style={{ color: '#dbdee1' }}>.zip</strong> plugin files here
          </div>
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={handleBrowse}
              style={{
                padding: '7px 18px', borderRadius: '4px', border: 'none',
                background: '#35373c', color: '#dbdee1', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500,
              }}
            >
              Browse Files…
            </button>
          </div>
        </div>
        {dropError && (
          <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '4px',
                        background: '#3a1c1d', color: '#ed4245', fontSize: '13px' }}>
            {dropError}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.ts,.zip"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {/* ── GitHub URL install ──────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#949ba4', marginBottom: '8px' }}>
          Install from GitHub URL
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setUrlError(''); }}
            onKeyDown={handleUrlKeyDown}
            placeholder="https://github.com/user/repo  or  raw.githubusercontent.com/…/plugin.js"
            style={inputStyle}
          />
          <button
            onClick={handleInstallUrl}
            disabled={urlBusy || !url.trim()}
            style={{
              padding: '8px 18px', borderRadius: '4px', border: 'none',
              background: '#5865f2', color: '#fff', cursor: urlBusy ? 'default' : 'pointer',
              fontSize: '14px', fontWeight: 500,
              opacity: (urlBusy || !url.trim()) ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {urlBusy ? 'Installing…' : 'Install'}
          </button>
        </div>
        {urlError && (
          <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '4px',
                        background: '#3a1c1d', color: '#ed4245', fontSize: '13px' }}>
            {urlError}
          </div>
        )}
        <div style={{ marginTop: '6px', fontSize: '12px', color: '#4f545c' }}>
          Accepted: raw file URL · GitHub blob URL (auto-converted) · GitHub repo URL (finds index.ts/js automatically)
        </div>
      </div>

      {/* ── Installed custom plugins ────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: '#949ba4', marginBottom: '8px' }}>
          Installed Custom Plugins{plugins.length > 0 ? ` (${plugins.length})` : ''}
        </div>

        {plugins.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#4f545c',
                        fontSize: '14px', background: '#2b2d31', borderRadius: '8px',
                        border: '1px dashed #3d3f45' }}>
            No custom plugins installed yet.
            <br />
            <span style={{ fontSize: '12px', color: '#3d3f45', marginTop: '4px', display: 'block' }}>
              Drop a plugin file above or paste a GitHub URL to get started.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plugins.map(entry => (
              <CustomPluginCard
                key={entry.id}
                entry={entry}
                onToggle={handleToggle}
                onRefresh={handleRefresh}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
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
    { id: 'custom',  label: 'Custom',        count: (window.CCCustomPlugins?.getMeta?.() ?? []).length, badgeColor: '#f0b132', warn: true },
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
