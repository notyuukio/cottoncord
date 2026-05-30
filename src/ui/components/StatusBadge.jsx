'use strict';

const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

const PALETTE = {
  working:    ['#23a55a', '#fff'],
  broken:     ['#ed4245', '#fff'],
  unverified: ['#f0b132', '#fff'],
  updating:   ['#5865f2', '#fff'],
  disabled:   ['#4f545c', '#b9bbbe'],
};

export default function StatusBadge({ status = 'disabled' }) {
  const [bg, fg] = PALETTE[status] ?? PALETTE.disabled;
  const label    = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span style={{
      display: 'inline-block', padding: '2px 6px', borderRadius: '3px',
      fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      background: bg, color: fg, lineHeight: '16px',
    }}>
      {label}
    </span>
  );
}
