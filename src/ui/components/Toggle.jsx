'use strict';

const React = window.ModuleStore?.findByProps?.('createElement', 'useState') ?? require('react');

export default function Toggle({ enabled = false, disabled = false, onChange }) {
  const [on, setOn] = React.useState(enabled);

  React.useEffect(() => { setOn(enabled); }, [enabled]);

  function handleClick() {
    if (disabled) return;
    const next = !on;
    setOn(next);
    onChange?.(next);
  }

  return (
    <div
      role="switch"
      aria-checked={on}
      onClick={handleClick}
      style={{
        width: '40px', height: '24px', borderRadius: '12px',
        background: on ? '#23a55a' : '#4f545c',
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s', flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: '2px',
        left: on ? '18px' : '2px',
        width: '20px', height: '20px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,.35)',
      }} />
    </div>
  );
}
