'use strict';

const path = require('path');

// ── CSS injected once into Discord's document.head ─────────────────────────
const STYLE_ID = 'cc-settings-styles';
const STYLE_CSS = `
.cc-sidebar-header {
  padding: 6px 10px 4px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: #949ba4; user-select: none;
}
.cc-sidebar-item {
  padding: 6px 10px; border-radius: 4px;
  margin: 1px 4px; cursor: pointer;
  font-size: 15px; font-weight: 500; color: #949ba4;
  transition: background .1s, color .1s;
}
.cc-sidebar-item:hover  { background: #35373c; color: #dbdee1; }
.cc-sidebar-item.active { background: #404249; color: #f2f3f5; }
.cc-content-root {
  flex: 1; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #1e1f22 transparent;
}
.cc-content-root::-webkit-scrollbar        { width: 8px; }
.cc-content-root::-webkit-scrollbar-thumb  { background: #1e1f22; border-radius: 4px; }
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head.appendChild(el);
}

// ── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
  { id: 'cc-main',       label: 'CottonCord',      component: () => require('./tabs/MainTab.jsx').default },
  { id: 'cc-plugins',    label: 'Plugins',          component: () => require('./tabs/PluginsTab.jsx').default },
  { id: 'cc-themes',     label: 'Themes',           component: () => require('./tabs/ThemesTab.jsx').default },
  { id: 'cc-updater',    label: 'Updater',          component: () => require('./tabs/UpdaterTab.jsx').default },
  { id: 'cc-backup',     label: 'Backup & Restore', component: () => require('./tabs/BackupTab.jsx').default },
  { id: 'cc-protection', label: 'IP Protection',    component: () => require('./tabs/ProtectionTab.jsx').default },
];

// ── React mount helpers ────────────────────────────────────────────────────

function getReact()    { return window.ModuleStore?.findByProps?.('createElement', 'useState'); }
function getReactDOM() { return window.ModuleStore?.findByProps?.('createRoot') || window.ModuleStore?.findByProps?.('render', 'unmountComponentAtNode'); }

let _root = null; // React 18 createRoot handle

function mountReact(container, element) {
  const ReactDOM = getReactDOM();
  if (!ReactDOM) return;
  if (ReactDOM.createRoot) {
    if (!_root || !container.contains(_root._internalRoot?.current?.stateNode)) {
      _root = ReactDOM.createRoot(container);
    }
    _root.render(element);
  } else {
    ReactDOM.render(element, container);
  }
}

// ── Settings panel React component ────────────────────────────────────────

function CCSettingsPanel({ initialTab }) {
  const React = getReact();
  const [activeTab, setActiveTab] = React.useState(initialTab ?? TABS[0].id);

  const tabDef     = TABS.find(t => t.id === activeTab) ?? TABS[0];
  const TabContent = tabDef.component();

  return (
    <div style={{ display: 'contents' }}>
      <TabContent />
    </div>
  );
}

// ── Discord settings injection ─────────────────────────────────────────────
// Strategy: patch getPredicateSections on the settings-view component so our
// sections appear in the sidebar natively. Falls back to MutationObserver
// DOM injection if the component cannot be located via findByString.

let _injected = false;

function patchGetPredicateSections() {
  const store   = window.ModuleStore;
  const patcher = window.CottonCordPatcher;
  if (!store || !patcher) return false;

  // Common strings found in Discord's settings-view component
  const candidate = store.findByString('getPredicateSections');
  if (!candidate) return false;

  const proto = candidate.prototype ?? candidate;

  // The method may be on the prototype or directly on the module object
  const methodName = Object.getOwnPropertyNames(proto).find(k =>
    k === 'getPredicateSections' || (typeof proto[k] === 'function' &&
      proto[k].toString().includes('section'))
  );
  if (!methodName) return false;

  patcher.after('CottonCord-Settings', proto, methodName, (ctx, args, sections) => {
    if (!Array.isArray(sections)) return;
    if (sections.some(s => s.section === 'cc-main')) return; // already injected

    sections.push(
      { section: 'DIVIDER' },
      { section: 'HEADER',  label: 'CottonCord' },
      ...TABS.map(t => ({
        section: t.id,
        label:   t.label,
        element: makeTabElement(t),
      })),
    );
  });

  return true;
}

function makeTabElement(tab) {
  // Returns a React function component that mounts the tab content.
  // Discord calls element() when it renders the content area.
  return function CCTabWrapper() {
    const React = getReact();
    if (!React) return null;
    const TabContent = tab.component();
    return React.createElement(TabContent, null);
  };
}

// ── DOM fallback injection ─────────────────────────────────────────────────
// If patchGetPredicateSections couldn't find the component, we watch for the
// settings DOM to appear and inject sidebar items + a content mount point.

let _domObserver = null;
let _activeCCTab = TABS[0].id;
let _contentMount = null;

function setupDOMInjection() {
  if (_domObserver) return;

  _domObserver = new MutationObserver(() => {
    // Discord's settings sidebar: look for the nav that contains known items
    const sidebar = document.querySelector('[class*="sidebar-"] [class*="scroller-"]')
                 ?? document.querySelector('[class*="sidebarList"]');
    if (!sidebar || sidebar.dataset.ccDone) return;
    sidebar.dataset.ccDone = 'true';
    injectDOMSidebar(sidebar);
  });

  _domObserver.observe(document.body, { childList: true, subtree: true });
}

function injectDOMSidebar(sidebar) {
  // Header
  const header = document.createElement('div');
  header.className = 'cc-sidebar-header';
  header.textContent = 'CottonCord';
  sidebar.appendChild(header);

  // Items
  TABS.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'cc-sidebar-item' + (tab.id === _activeCCTab ? ' active' : '');
    item.textContent = tab.label;
    item.dataset.ccTab = tab.id;
    item.addEventListener('click', () => switchDOMTab(tab.id, sidebar));
    sidebar.appendChild(item);
  });

  // Prepare content mount (Discord's content area lives next to the sidebar)
  const contentArea = sidebar.closest('[class*="standardSidebarView-"]')
                   ?? sidebar.closest('[class*="contentRegion-"]')?.parentElement;
  if (contentArea) {
    _contentMount = document.createElement('div');
    _contentMount.className = 'cc-content-root';
    _contentMount.style.display = 'none';
    contentArea.appendChild(_contentMount);
    renderDOMTab(_activeCCTab);
  }
}

function switchDOMTab(tabId, sidebar) {
  _activeCCTab = tabId;
  sidebar.querySelectorAll('.cc-sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.ccTab === tabId);
  });
  if (_contentMount) {
    _contentMount.style.display = '';
    renderDOMTab(tabId);
    // Try to hide Discord's own content area when a CC tab is active
    const discordContent = _contentMount.previousElementSibling;
    if (discordContent) discordContent.style.display = 'none';
  }
}

function renderDOMTab(tabId) {
  if (!_contentMount) return;
  const tab    = TABS.find(t => t.id === tabId);
  if (!tab) return;
  const React = getReact();
  if (!React) return;
  mountReact(_contentMount, React.createElement(tab.component(), null));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

function init() {
  try {
    injectStyles();
    const patched = patchGetPredicateSections();
    if (!patched) setupDOMInjection();
  } catch (err) {
    console.error('[CottonCord] settingsPanel: init error:', err.message);
  }
}

// Wait for ModuleStore to finish capturing webpack modules before we try
// findByString — it's async and might not be done at require() time.
function waitThenInit(attempts = 0) {
  const count = window.ModuleStore?.getModuleCount?.() ?? 0;
  if (count > 0 || attempts > 50) { init(); return; }
  setTimeout(() => waitThenInit(attempts + 1), 200);
}

waitThenInit();

module.exports = {};
