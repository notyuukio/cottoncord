'use strict';

const React      = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');
const Toggle     = require('./Toggle.jsx').default;
const StatusBadge = require('./StatusBadge.jsx').default;

const SOURCE_STYLE = {
  betterdiscord: { label: 'BD',      bg: '#f0b132', fg: '#fff' },
  vencord:       { label: 'Vencord', bg: '#5865f2', fg: '#fff' },
};

export default function PluginCard({ plugin, onToggle }) {
  const [enabled, setEnabled] = React.useState(plugin.enabled ?? true);
  const src    = SOURCE_STYLE[plugin.source] ?? SOURCE_STYLE.vencord;
  const status = plugin.broken      ? 'broken'
               : plugin.unverified  ? 'unverified'
               : enabled            ? 'working'
               :                      'disabled';

  function handleToggle(val) {
    setEnabled(val);
    onToggle?.(plugin.name, val);
  }

  return (
    <div style={{
      background: '#2b2d31', borderRadius: '8px', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      border: '1px solid #1e1f22',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '14px', whiteSpace: 'nowrap' }}>
            {plugin.name}
          </span>
          <span style={{
            padding: '1px 5px', borderRadius: '3px', fontSize: '10px',
            fontWeight: 700, background: src.bg, color: src.fg, flexShrink: 0,
          }}>
            {src.label}
          </span>
          <StatusBadge status={status} />
        </div>
        <Toggle enabled={enabled} disabled={plugin.broken} onChange={handleToggle} />
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: '13px', color: '#949ba4', lineHeight: '1.4' }}>
        {plugin.description || 'No description provided.'}
      </p>

      {/* Version */}
      {plugin.version && (
        <span style={{ fontSize: '11px', color: '#6d6f78' }}>v{plugin.version}</span>
      )}
    </div>
  );
}
