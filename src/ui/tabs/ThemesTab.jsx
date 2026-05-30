'use strict';

const fs   = require('fs');
const path = require('path');
const React  = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');
const Toggle = require('../components/Toggle.jsx').default;

const THEMES_DIR  = path.join(__dirname, '..', '..', '..', 'plugins', 'themes');
const THEMES_META = path.join(THEMES_DIR, 'themes-meta.json');

function ensureThemesDir() {
  try { fs.mkdirSync(THEMES_DIR, { recursive: true }); } catch (_) {}
}

function readMeta() {
  try { return JSON.parse(fs.readFileSync(THEMES_META, 'utf8')); } catch (_) { return []; }
}

function saveMeta(meta) {
  try { fs.writeFileSync(THEMES_META, JSON.stringify(meta, null, 2)); } catch (_) {}
}

function applyTheme(name, css) {
  const id = `cc-theme-${name}`;
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
  el.textContent = css;
}

function removeTheme(name) {
  document.getElementById(`cc-theme-${name}`)?.remove();
}

export default function ThemesTab() {
  ensureThemesDir();
  const [themes, setThemes]   = React.useState(() => {
    const meta = readMeta();
    // Re-apply enabled themes on mount
    meta.filter(t => t.enabled).forEach(t => {
      try { applyTheme(t.name, fs.readFileSync(t.file, 'utf8')); } catch (_) {}
    });
    return meta;
  });
  const [dragOver, setDragOver] = React.useState(false);

  function installTheme(fileName, css) {
    const name = path.basename(fileName, '.css');
    const dest = path.join(THEMES_DIR, fileName);
    fs.writeFileSync(dest, css, 'utf8');
    const entry = { name, file: dest, enabled: true };
    applyTheme(name, css);
    const next = [...themes.filter(t => t.name !== name), entry];
    saveMeta(next);
    setThemes(next);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    for (const file of e.dataTransfer.files) {
      if (!file.name.endsWith('.css')) continue;
      const reader = new FileReader();
      reader.onload = ev => installTheme(file.name, ev.target.result);
      reader.readAsText(file);
    }
  }

  function toggleTheme(name, enabled) {
    const theme = themes.find(t => t.name === name);
    if (!theme) return;
    if (enabled) {
      try { applyTheme(name, fs.readFileSync(theme.file, 'utf8')); } catch (_) {}
    } else {
      removeTheme(name);
    }
    const next = themes.map(t => t.name === name ? { ...t, enabled } : t);
    saveMeta(next);
    setThemes(next);
  }

  function deleteTheme(name) {
    const theme = themes.find(t => t.name === name);
    if (theme) { try { fs.unlinkSync(theme.file); } catch (_) {} }
    removeTheme(name);
    const next = themes.filter(t => t.name !== name);
    saveMeta(next);
    setThemes(next);
  }

  return (
    <div style={{ padding: '32px 40px', color: '#dbdee1', maxWidth: '680px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#f2f3f5' }}>Themes</h2>

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
          marginBottom: '20px',
        }}
      >
        Drop <strong>.css</strong> theme files here to install
      </div>

      {themes.length === 0 ? (
        <p style={{ color: '#6d6f78', fontSize: '14px' }}>No themes installed yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {themes.map(t => (
            <div key={t.name} style={{
              background: '#2b2d31', border: '1px solid #1e1f22', borderRadius: '8px',
              padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '14px' }}>{t.name}</span>
              </div>
              <Toggle enabled={t.enabled} onChange={v => toggleTheme(t.name, v)} />
              <button
                onClick={() => deleteTheme(t.name)}
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
