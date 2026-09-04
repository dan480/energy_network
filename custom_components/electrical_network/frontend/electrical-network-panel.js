const ELECTRICAL_NETWORK_VERSION = "0.1.0";

const NODE_TYPE_META = {
  source: { label: "Ввод", icon: "mdi:transmission-tower", w: 180, h: 164 },
  breaker: { label: "Автомат", icon: "mdi:electric-switch", w: 240, h: 126 },
  rcd: { label: "УЗО / дифавтомат", icon: "mdi:shield-bolt", w: 220, h: 140 },
  board: { label: "Распределительный щит", icon: "mdi:electric-switchboard", w: 410, h: 330 },
  load: { label: "Потребитель", icon: "mdi:power-plug", w: 225, h: 118 },
  meter: { label: "Счётчик", icon: "mdi:meter-electric", w: 220, h: 140 },
  junction: { label: "Соединение", icon: "mdi:source-branch", w: 150, h: 96 },
};

const ENTITY_KEYS = ["state", "power", "current", "voltage", "energy", "frequency", "temperature"];
const METRIC_LABELS = {
  power: "Мощность",
  current: "Ток",
  voltage: "Напряжение",
  energy: "Энергия сегодня",
  frequency: "Частота",
  temperature: "Температура",
};
const OFF_STATES = new Set(["off", "closed", "idle", "standby", "not_home", "0", "false"]);
const UNAVAILABLE_STATES = new Set(["unavailable", "unknown", "none", ""]);

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 1) => {
  const scale = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
};
const parseNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".").replace(/[^0-9eE+\-.]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const PANEL_STYLES = `
  :host {
    --en-accent: var(--primary-color, #3ea6ff);
    --en-accent-rgb: 62, 166, 255;
    --en-ok: var(--success-color, #45d483);
    --en-warning: var(--warning-color, #ffb74d);
    --en-danger: var(--error-color, #ff5f62);
    --en-panel: var(--card-background-color, #111a24);
    --en-panel-2: color-mix(in srgb, var(--card-background-color, #111a24) 88%, #1f3042);
    --en-border: color-mix(in srgb, var(--divider-color, #405060) 72%, transparent);
    --en-text: var(--primary-text-color, #e7edf5);
    --en-muted: var(--secondary-text-color, #9aa8b8);
    --en-bg: var(--primary-background-color, #08111b);
    display: block;
    height: 100%;
    min-height: 600px;
    color: var(--en-text);
    background:
      radial-gradient(circle at 78% 4%, rgba(var(--en-accent-rgb), .08), transparent 33%),
      var(--en-bg);
    font-family: var(--paper-font-body1_-_font-family, Roboto, system-ui, sans-serif);
    overflow: hidden;
  }
  * { box-sizing: border-box; }
  button, input, textarea, select { font: inherit; }
  button { color: inherit; }
  .panel-shell { display: flex; flex-direction: column; height: 100%; min-height: 600px; }
  .topbar {
    min-height: 76px;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 13px 18px 12px 22px;
    border-bottom: 1px solid var(--en-border);
    background: color-mix(in srgb, var(--en-bg) 90%, transparent);
    backdrop-filter: blur(14px);
    z-index: 20;
  }
  .title-block { min-width: 220px; margin-right: auto; }
  .title-line { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 0; font-size: 24px; line-height: 1.2; font-weight: 560; letter-spacing: -.25px; }
  .version { color: var(--en-muted); font-size: 11px; padding-top: 4px; }
  .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .btn, .icon-btn, .menu-item {
    border: 1px solid var(--en-border);
    background: color-mix(in srgb, var(--en-panel) 88%, transparent);
    border-radius: 9px;
    min-height: 38px;
    padding: 0 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: border-color .18s, background .18s, transform .12s, opacity .18s;
    white-space: nowrap;
  }
  .btn:hover, .icon-btn:hover, .menu-item:hover { border-color: var(--en-accent); background: rgba(var(--en-accent-rgb), .10); }
  .btn:active, .icon-btn:active { transform: translateY(1px); }
  .btn.primary { background: var(--en-accent); color: var(--text-primary-color, #fff); border-color: var(--en-accent); box-shadow: 0 8px 24px rgba(var(--en-accent-rgb), .22); }
  .btn.active { border-color: var(--en-accent); color: var(--en-accent); background: rgba(var(--en-accent-rgb), .14); }
  .btn.danger { color: var(--en-danger); border-color: color-mix(in srgb, var(--en-danger) 60%, transparent); }
  .btn[disabled], .icon-btn[disabled] { opacity: .4; cursor: not-allowed; pointer-events: none; }
  .icon-btn { width: 38px; padding: 0; }
  .btn ha-icon, .icon-btn ha-icon, .menu-item ha-icon { --mdc-icon-size: 19px; }
  .save-state { min-width: 92px; display: inline-flex; align-items: center; justify-content: flex-end; gap: 7px; color: var(--en-muted); font-size: 12px; }
  .save-state .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--en-ok); box-shadow: 0 0 10px var(--en-ok); }
  .save-state.dirty .dot { background: var(--en-warning); box-shadow: 0 0 10px var(--en-warning); }
  .save-state.error .dot { background: var(--en-danger); box-shadow: 0 0 10px var(--en-danger); }
  details.more { position: relative; }
  details.more > summary { list-style: none; }
  details.more > summary::-webkit-details-marker { display: none; }
  .menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 220px;
    padding: 7px;
    border: 1px solid var(--en-border);
    border-radius: 12px;
    background: var(--en-panel);
    box-shadow: 0 18px 50px rgba(0,0,0,.35);
    z-index: 100;
  }
  .menu-item { width: 100%; justify-content: flex-start; min-height: 40px; border: 0; background: transparent; }
  .menu-sep { height: 1px; background: var(--en-border); margin: 6px 4px; }
  .main-layout { --en-inspector-width: 350px; min-height: 0; flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) var(--en-inspector-width); }
  .main-layout.inspector-closed { --en-inspector-width: 0px; }
  .main-layout.inspector-closed .inspector { visibility: hidden; width: 0; border-left: 0; overflow: hidden; }
  .workbench { min-width: 0; min-height: 0; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .summary-strip { display: flex; gap: 10px; align-items: stretch; min-height: 76px; overflow-x: auto; scrollbar-width: thin; }
  .stat-card {
    min-width: 180px;
    padding: 11px 14px;
    border: 1px solid var(--en-border);
    border-radius: 12px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--en-panel) 94%, transparent), color-mix(in srgb, var(--en-panel-2) 92%, transparent));
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 8px;
    align-items: center;
  }
  .stat-card .stat-icon { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: rgba(var(--en-accent-rgb), .12); color: var(--en-accent); }
  .stat-card .label { font-size: 11px; color: var(--en-muted); }
  .stat-card .value { font-size: 20px; font-weight: 650; line-height: 1.2; }
  .stat-card .sub { grid-column: 1 / -1; display: flex; gap: 10px; color: var(--en-muted); font-size: 11px; }
  .demo-badge { margin-left: auto; align-self: center; border: 1px solid var(--en-warning); color: var(--en-warning); border-radius: 999px; padding: 5px 9px; font-size: 11px; white-space: nowrap; }
  .canvas-card { position: relative; min-height: 0; flex: 1; border: 1px solid var(--en-border); border-radius: 14px; overflow: hidden; background: color-mix(in srgb, var(--en-bg) 92%, #0c1723); }
  .canvas-actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 15; }
  .canvas-actions .icon-btn { background: color-mix(in srgb, var(--en-panel) 93%, transparent); box-shadow: 0 4px 18px rgba(0,0,0,.18); }
  .canvas {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    outline: none;
    cursor: grab;
    user-select: none;
  }
  .canvas.panning { cursor: grabbing; }
  .surface {
    position: absolute;
    left: 0;
    top: 0;
    width: 2200px;
    height: 1400px;
    transform-origin: 0 0;
    will-change: transform;
  }
  .canvas.show-grid {
    background-image:
      linear-gradient(to right, color-mix(in srgb, var(--en-border) 25%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in srgb, var(--en-border) 25%, transparent) 1px, transparent 1px);
    background-size: 20px 20px;
  }
  .edge-layer, .node-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .edge-layer { pointer-events: none; z-index: 2; }
  .node-layer { z-index: 3; }
  .wire-glow { fill: none; stroke: rgba(var(--en-accent-rgb), .22); stroke-width: 12; filter: blur(5px); opacity: 0; }
  .wire-base { fill: none; stroke: #5e6a79; stroke-width: 3; vector-effect: non-scaling-stroke; transition: stroke .25s, opacity .25s; }
  .wire-dots { fill: none; stroke: var(--en-accent); stroke-width: 5; stroke-linecap: round; stroke-dasharray: .1 15; vector-effect: non-scaling-stroke; opacity: 0; filter: drop-shadow(0 0 5px rgba(var(--en-accent-rgb), .85)); animation: en-flow var(--flow-duration, 1.8s) linear infinite; }
  .edge.energized .wire-base { stroke: color-mix(in srgb, var(--en-accent) 78%, #b6dfff); }
  .edge.energized .wire-glow { opacity: .85; }
  .edge.flowing .wire-dots { opacity: 1; }
  .edge.off .wire-base { stroke: #56606d; stroke-dasharray: 5 8; opacity: .72; }
  .edge.unavailable .wire-base { stroke: var(--en-warning); stroke-dasharray: 3 8; opacity: .75; }
  .edge.selected .wire-base { stroke-width: 5; stroke: var(--en-accent); }
  .edge-hit { fill: none; stroke: transparent; stroke-width: 22; pointer-events: stroke; cursor: pointer; vector-effect: non-scaling-stroke; }
  .edge-label { fill: var(--en-muted); font-size: 12px; paint-order: stroke; stroke: var(--en-bg); stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
  @keyframes en-flow { to { stroke-dashoffset: -60; } }
  @media (prefers-reduced-motion: reduce) { .wire-dots { animation: none; stroke-dasharray: 3 12; } }
  .diagram-node {
    position: absolute;
    border: 1px solid color-mix(in srgb, var(--en-border) 88%, transparent);
    border-radius: 13px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--en-panel) 97%, transparent), color-mix(in srgb, var(--en-panel-2) 97%, transparent));
    color: var(--en-text);
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    overflow: hidden;
    transition: border-color .18s, box-shadow .18s, opacity .18s;
    cursor: pointer;
  }
  .diagram-node:not(.board):hover { border-color: color-mix(in srgb, var(--en-accent) 60%, var(--en-border)); }
  .diagram-node.selected { border-color: var(--en-accent); box-shadow: 0 0 0 1px var(--en-accent), 0 0 24px rgba(var(--en-accent-rgb), .24); }
  .diagram-node.connect-source { border-color: var(--en-warning); box-shadow: 0 0 0 2px var(--en-warning), 0 0 25px color-mix(in srgb, var(--en-warning) 35%, transparent); }
  .diagram-node.inactive { opacity: .72; }
  .diagram-node.unavailable { border-color: color-mix(in srgb, var(--en-warning) 58%, transparent); }
  .diagram-node.board { z-index: 1; border-radius: 16px; background: linear-gradient(160deg, color-mix(in srgb, var(--en-panel) 88%, transparent), color-mix(in srgb, var(--en-bg) 90%, transparent)); border-color: color-mix(in srgb, var(--en-accent) 30%, var(--en-border)); box-shadow: inset 0 0 0 1px rgba(var(--en-accent-rgb), .04), 0 12px 34px rgba(0,0,0,.16); }
  .board-header { height: 58px; padding: 0 17px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--en-border); background: rgba(var(--en-accent-rgb), .035); }
  .board-header ha-icon { color: var(--en-accent); --mdc-icon-size: 23px; }
  .board-title { font-size: 16px; font-weight: 560; flex: 1; }
  .board-count { color: var(--en-muted); font-size: 11px; }
  .board-bus { position: absolute; left: 17px; top: 76px; bottom: 18px; width: 2px; background: color-mix(in srgb, var(--en-accent) 52%, var(--en-border)); box-shadow: 0 0 10px rgba(var(--en-accent-rgb), .2); border-radius: 2px; }
  .node-content { height: 100%; display: grid; grid-template-columns: 50px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 12px 13px; }
  .node-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--en-accent) 52%, var(--en-border)); background: rgba(var(--en-accent-rgb), .08); color: var(--en-accent); box-shadow: 0 0 16px rgba(var(--en-accent-rgb), .08); }
  .node-icon ha-icon { --mdc-icon-size: 28px; }
  .type-source .node-icon { width: 60px; height: 60px; }
  .type-source .node-content { grid-template-columns: 62px minmax(0,1fr); grid-template-rows: 1fr auto; }
  .node-info { min-width: 0; }
  .node-title-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .node-name { font-weight: 620; font-size: 14px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nominal { border: 1px solid var(--en-border); border-radius: 6px; padding: 2px 6px; color: var(--en-muted); font-size: 10px; white-space: nowrap; }
  .node-kind { color: var(--en-muted); font-size: 11px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entity-chip { margin-top: 8px; display: inline-flex; max-width: 100%; padding: 3px 7px; border: 1px solid rgba(var(--en-accent-rgb), .17); border-radius: 6px; background: rgba(var(--en-accent-rgb), .05); color: color-mix(in srgb, var(--en-accent) 76%, var(--en-muted)); font-size: 9.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .metric-grid { display: grid; grid-template-columns: auto auto; gap: 4px 8px; font-size: 11px; min-width: 88px; }
  .metric-grid .k { color: var(--en-muted); }
  .metric-grid .v { text-align: right; font-variant-numeric: tabular-nums; }
  .diagram-node.compact .node-content {
    grid-template-columns: 42px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 4px 8px;
    padding: 8px 10px;
  }
  .diagram-node.compact .node-icon,
  .diagram-node.compact.type-source .node-icon { width: 40px; height: 40px; }
  .diagram-node.compact .node-icon ha-icon { --mdc-icon-size: 23px; }
  .diagram-node.compact .node-info { grid-column: 2; min-width: 0; }
  .diagram-node.compact .node-name { font-size: 12px; }
  .diagram-node.compact .node-kind { margin-top: 2px; font-size: 9px; }
  .diagram-node.compact .entity-chip { margin-top: 3px; padding: 2px 5px; font-size: 8px; }
  .diagram-node.compact .metric-grid {
    grid-column: 1 / -1;
    grid-template-columns: auto auto auto auto auto auto;
    justify-content: space-between;
    gap: 3px;
    min-width: 0;
    font-size: 9px;
  }
  .diagram-node.compact .metric-grid .v { text-align: left; }
  .diagram-node.compact.type-source .node-content {
    grid-template-columns: 42px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .status-dot { position: absolute; right: 9px; top: 9px; width: 8px; height: 8px; border-radius: 50%; background: #67717d; box-shadow: 0 0 0 3px color-mix(in srgb, var(--en-panel) 82%, transparent); }
  .diagram-node.energized .status-dot { background: var(--en-ok); box-shadow: 0 0 10px var(--en-ok), 0 0 0 3px color-mix(in srgb, var(--en-panel) 82%, transparent); }
  .diagram-node.unavailable .status-dot { background: var(--en-warning); box-shadow: 0 0 9px var(--en-warning); }
  .port { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: var(--en-accent); box-shadow: 0 0 10px rgba(var(--en-accent-rgb), .8); opacity: 0; transition: opacity .15s; }
  .edit-mode .diagram-node:hover .port, .connect-mode .diagram-node .port { opacity: 1; }
  .port.left { left: -5px; top: calc(50% - 5px); }
  .port.right { right: -5px; top: calc(50% - 5px); }
  .port.top { top: -5px; left: calc(50% - 5px); }
  .port.bottom { bottom: -5px; left: calc(50% - 5px); }
  .dragging-node { opacity: .86; cursor: grabbing !important; }
  .legend { position: absolute; left: 14px; bottom: 12px; display: flex; gap: 14px; align-items: center; padding: 7px 10px; border: 1px solid var(--en-border); border-radius: 9px; background: color-mix(in srgb, var(--en-panel) 88%, transparent); font-size: 10px; color: var(--en-muted); z-index: 12; pointer-events: none; }
  .legend span { display: flex; align-items: center; gap: 6px; }
  .legend i { display: inline-block; width: 28px; height: 3px; border-radius: 3px; background: #5e6874; }
  .legend i.on { background: var(--en-accent); box-shadow: 0 0 7px rgba(var(--en-accent-rgb), .8); }
  .legend i.flow { height: 5px; background: repeating-linear-gradient(90deg, var(--en-accent) 0 4px, transparent 4px 9px); }
  .phase-card { min-width: 300px; }
  .phases { display: grid; grid-template-columns: repeat(3, minmax(70px,1fr)); gap: 7px; grid-column: 1/-1; }
  .phase { border-left: 2px solid var(--phase-color); padding-left: 7px; }
  .phase .phase-name { font-weight: 600; font-size: 11px; }
  .phase .phase-value { font-size: 12px; margin-top: 2px; }
  .phase .phase-sub { color: var(--en-muted); font-size: 10px; }
  .inspector { min-width: 0; min-height: 0; border-left: 1px solid var(--en-border); background: color-mix(in srgb, var(--en-panel) 84%, var(--en-bg)); overflow-y: auto; scrollbar-width: thin; position: relative; z-index: 30; }
  .inspector-empty { display: grid; place-items: center; min-height: 100%; padding: 30px; color: var(--en-muted); text-align: center; }
  .inspector-header { min-height: 112px; padding: 19px 18px 15px; display: flex; gap: 13px; align-items: flex-start; border-bottom: 1px solid var(--en-border); }
  .inspector-icon { width: 48px; height: 48px; border-radius: 11px; display: grid; place-items: center; background: rgba(var(--en-accent-rgb), .10); color: var(--en-accent); border: 1px solid rgba(var(--en-accent-rgb), .24); flex: none; }
  .inspector-icon ha-icon { --mdc-icon-size: 29px; }
  .inspector-heading { min-width: 0; flex: 1; }
  .inspector-heading h2 { margin: 0; font-size: 17px; line-height: 1.3; overflow-wrap: anywhere; }
  .status-pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 7px; border-radius: 999px; padding: 4px 8px; background: color-mix(in srgb, var(--en-ok) 14%, transparent); color: var(--en-ok); font-size: 10px; }
  .status-pill.off { color: var(--en-muted); background: color-mix(in srgb, var(--en-muted) 12%, transparent); }
  .inspector-body { padding: 14px 17px 24px; }
  .section { padding: 12px 0 14px; border-bottom: 1px solid var(--en-border); }
  .section:last-child { border-bottom: 0; }
  .section-title { margin: 0 0 10px; font-size: 12px; font-weight: 650; letter-spacing: .2px; }
  .read-row { display: grid; grid-template-columns: minmax(95px, .8fr) minmax(0,1.2fr); gap: 12px; padding: 6px 0; font-size: 12px; }
  .read-row .read-key { color: var(--en-muted); }
  .read-row .read-value { text-align: right; overflow-wrap: anywhere; }
  .form-grid { display: grid; gap: 10px; }
  .field { display: grid; gap: 5px; }
  .field.two { grid-template-columns: 1fr 1fr; gap: 9px; }
  .field label, label.field { color: var(--en-muted); font-size: 10.5px; }
  .field input, .field textarea, .field select, label.field input, label.field select, .entity-field input {
    width: 100%;
    min-height: 38px;
    border: 1px solid var(--en-border);
    border-radius: 8px;
    padding: 8px 9px;
    color: var(--en-text);
    background: color-mix(in srgb, var(--en-bg) 72%, transparent);
    outline: none;
  }
  .field textarea { min-height: 72px; resize: vertical; }
  .field input:focus, .field textarea:focus, .field select:focus { border-color: var(--en-accent); box-shadow: 0 0 0 2px rgba(var(--en-accent-rgb), .12); }
  .switch-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; min-height: 38px; color: var(--en-text); font-size: 12px; }
  .switch-row input { width: 18px; height: 18px; accent-color: var(--en-accent); }
  .entity-field { display: grid; grid-template-columns: 98px 1fr 34px; gap: 7px; align-items: center; }
  .entity-field .entity-label { color: var(--en-muted); font-size: 10.5px; }
  .entity-field input { min-width: 0; }
  .mini-action { width: 34px; height: 34px; border: 1px solid var(--en-border); border-radius: 8px; display: grid; place-items: center; background: transparent; cursor: pointer; }
  .mini-action:hover { border-color: var(--en-accent); color: var(--en-accent); }
  .mini-action ha-icon { --mdc-icon-size: 17px; }
  .button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .button-row .btn { min-height: 36px; font-size: 12px; }
  .warning-box { border: 1px solid color-mix(in srgb, var(--en-warning) 45%, transparent); background: color-mix(in srgb, var(--en-warning) 8%, transparent); color: color-mix(in srgb, var(--en-warning) 78%, var(--en-text)); border-radius: 9px; padding: 9px 10px; font-size: 11px; line-height: 1.45; }
  .loading { position: absolute; inset: 0; z-index: 200; display: grid; place-items: center; background: var(--en-bg); }
  .loading-card { display: grid; place-items: center; gap: 12px; color: var(--en-muted); }
  .spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--en-border); border-top-color: var(--en-accent); animation: spin .9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 20px); opacity: 0; pointer-events: none; z-index: 500; max-width: min(520px, calc(100vw - 32px)); padding: 10px 14px; border: 1px solid var(--en-border); border-radius: 10px; background: color-mix(in srgb, var(--en-panel) 96%, #000); box-shadow: 0 14px 44px rgba(0,0,0,.38); color: var(--en-text); font-size: 12px; transition: opacity .2s, transform .2s; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  .toast.error { border-color: var(--en-danger); }
  .modal-backdrop { position: fixed; inset: 0; z-index: 600; background: rgba(0,0,0,.58); display: grid; place-items: center; padding: 18px; }
  .modal { width: min(720px, 100%); max-height: min(760px, calc(100vh - 36px)); overflow: auto; border: 1px solid var(--en-border); border-radius: 15px; background: var(--en-panel); box-shadow: 0 24px 90px rgba(0,0,0,.52); }
  .modal-head { display: flex; align-items: center; gap: 12px; padding: 15px 17px; border-bottom: 1px solid var(--en-border); }
  .modal-head h3 { margin: 0; font-size: 17px; flex: 1; }
  .modal-body { padding: 16px 17px; }
  .modal-foot { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; padding: 13px 17px 16px; border-top: 1px solid var(--en-border); }
  .modal textarea { width: 100%; min-height: 390px; resize: vertical; border: 1px solid var(--en-border); border-radius: 9px; padding: 11px; color: var(--en-text); background: var(--en-bg); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; outline: none; }
  .modal .node-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
  .node-type-option { min-height: 90px; display: grid; place-items: center; gap: 7px; border: 1px solid var(--en-border); border-radius: 11px; background: color-mix(in srgb, var(--en-bg) 70%, transparent); cursor: pointer; }
  .node-type-option:hover { border-color: var(--en-accent); background: rgba(var(--en-accent-rgb), .08); }
  .node-type-option ha-icon { color: var(--en-accent); --mdc-icon-size: 28px; }
  .node-type-option span { font-size: 12px; }
  .readonly-note { margin-left: auto; color: var(--en-warning); font-size: 11px; }
  @media (max-width: 1180px) {
    .main-layout { --en-inspector-width: 320px; }
    .topbar { gap: 10px; }
    .btn .btn-text.hide-mid { display: none; }
    .btn { padding: 0 10px; }
  }
  @media (max-width: 900px) {
    :host { min-height: 520px; }
    .topbar { min-height: 64px; padding: 10px 12px; }
    h1 { font-size: 20px; }
    .title-block { min-width: 0; }
    .version { display: none; }
    .toolbar .btn.secondary-action { display: none; }
    .main-layout { --en-inspector-width: 0px; grid-template-columns: 1fr; position: relative; }
    .main-layout.inspector-closed .inspector { visibility: visible; width: min(360px, 92vw); border-left: 1px solid var(--en-border); overflow-y: auto; }
    .workbench { padding: 9px; }
    .summary-strip { min-height: 68px; }
    .stat-card { min-width: 155px; padding: 8px 10px; }
    .stat-card .value { font-size: 17px; }
    .inspector { position: absolute; top: 0; right: 0; bottom: 0; width: min(360px, 92vw); transform: translateX(102%); transition: transform .22s ease; box-shadow: -15px 0 45px rgba(0,0,0,.36); }
    .inspector.open { transform: translateX(0); }
  }
  @media (max-width: 600px) {
    .toolbar .btn:not(.primary):not(.active) .btn-text { display: none; }
    .save-state { display: none; }
    .summary-strip .phase-card { display: none; }
    .modal .node-type-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

class ElectricalNetworkPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._config = null;
    this._revision = null;
    this._loaded = false;
    this._loading = false;
    this._dirty = false;
    this._saveStatus = "saved";
    this._saveTimer = null;
    this._toastTimer = null;
    this._liveFrame = null;
    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._editing = false;
    this._connectMode = false;
    this._connectFrom = null;
    this._drag = null;
    this._pan = null;
    this._didDrag = false;
    this._inspectorOpen = false;
    this._nodeById = new Map();
    this._outgoing = new Map();
    this._incoming = new Map();
    this._metricCache = new Map();
    this._subtreeCache = new Map();
    this._changeVersion = 0;
    this._pendingImport = null;
    this._boundKeydown = (event) => this._onKeydown(event);
    this._boundKeyup = (event) => this._onKeyup(event);
    this._spaceDown = false;
  }

  set hass(value) {
    this._hass = value;
    this._maybeLoad();
    this._scheduleLiveUpdate();
  }

  get hass() {
    return this._hass;
  }

  set panel(value) {
    this._panel = value;
    this._maybeLoad();
  }

  get panel() {
    return this._panel;
  }

  set narrow(value) {
    if (value) this.setAttribute("narrow", "");
    else this.removeAttribute("narrow");
  }

  connectedCallback() {
    if (!this.shadowRoot.innerHTML) this._renderShell();
    window.addEventListener("keydown", this._boundKeydown);
    window.addEventListener("keyup", this._boundKeyup);
    this._maybeLoad();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._boundKeydown);
    window.removeEventListener("keyup", this._boundKeyup);
    const dragListeners = this._drag?.listeners;
    if (dragListeners) {
      window.removeEventListener("pointermove", dragListeners.move);
      window.removeEventListener("pointerup", dragListeners.up);
    }
    const panListeners = this._pan?.listeners;
    if (panListeners) {
      window.removeEventListener("pointermove", panListeners.move);
      window.removeEventListener("pointerup", panListeners.up);
    }
    if (this._dirty && this._config?.settings?.auto_save && this._isAdmin()) void this._save();
    else if (this._saveTimer) clearTimeout(this._saveTimer);
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (this._liveFrame) cancelAnimationFrame(this._liveFrame);
    this._drag = null;
    this._pan = null;
  }

  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>${PANEL_STYLES}</style>
      <div class="panel-shell">
        <header class="topbar">
          <div class="title-block">
            <div class="title-line">
              <h1 id="page-title">Электросхема дома</h1>
              <ha-icon icon="mdi:information-outline" title="Визуальная модель, не проектная документация"></ha-icon>
            </div>
            <div class="version">Electrical Network Designer v${ELECTRICAL_NETWORK_VERSION}</div>
          </div>
          <div class="toolbar" id="toolbar"></div>
        </header>
        <div class="main-layout" id="main-layout">
          <section class="workbench">
            <div class="summary-strip" id="summary"></div>
            <div class="canvas-card">
              <div class="canvas-actions">
                <button class="icon-btn" data-action="zoom-out" title="Уменьшить"><ha-icon icon="mdi:magnify-minus-outline"></ha-icon></button>
                <button class="icon-btn" data-action="fit" title="Показать всю схему"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button>
                <button class="icon-btn" data-action="zoom-in" title="Увеличить"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></button>
              </div>
              <div class="canvas" id="canvas" tabindex="0">
                <div class="surface" id="surface">
                  <svg class="edge-layer" id="edge-layer" xmlns="http://www.w3.org/2000/svg"></svg>
                  <div class="node-layer" id="node-layer"></div>
                </div>
              </div>
              <div class="legend">
                <span><i class="on"></i> Есть питание</span>
                <span><i class="flow"></i> Идёт нагрузка</span>
                <span><i></i> Нет питания</span>
              </div>
            </div>
          </section>
          <aside class="inspector" id="inspector"></aside>
        </div>
      </div>
      <div class="loading" id="loading">
        <div class="loading-card"><div class="spinner"></div><div>Загрузка электросхемы…</div></div>
      </div>
      <div class="toast" id="toast"></div>
      <div id="modal-host"></div>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
      <datalist id="entity-list"></datalist>
    `;

    this.shadowRoot.addEventListener("click", (event) => this._onClick(event));
    this.shadowRoot.addEventListener("input", (event) => this._onInput(event));
    this.shadowRoot.addEventListener("change", (event) => this._onChange(event));
    this.shadowRoot.getElementById("node-layer").addEventListener("pointerdown", (event) => this._onNodePointerDown(event));
    this.shadowRoot.getElementById("edge-layer").addEventListener("click", (event) => this._onEdgeClick(event));
    const canvas = this.shadowRoot.getElementById("canvas");
    canvas.addEventListener("pointerdown", (event) => this._onCanvasPointerDown(event));
    canvas.addEventListener("wheel", (event) => this._onWheel(event), { passive: false });
    this.shadowRoot.getElementById("import-file").addEventListener("change", (event) => this._onImportFile(event));
  }

  _isAdmin() {
    return Boolean(this._hass?.user?.is_admin);
  }

  _entryId() {
    return this._panel?.config?.entry_id || null;
  }

  async _ws(message) {
    if (!this._hass) throw new Error("Home Assistant connection is not ready");
    if (typeof this._hass.callWS === "function") return this._hass.callWS(message);
    const response = await this._hass.connection.sendMessagePromise(message);
    return response?.result ?? response;
  }

  async _maybeLoad() {
    if (this._loaded || this._loading || !this._hass || !this._panel || !this.isConnected) return;
    if (!this.shadowRoot.getElementById("loading")) return;
    this._loading = true;
    try {
      const result = await this._ws({
        type: "electrical_network/config/get",
        entry_id: this._entryId(),
      });
      this._revision = result.revision;
      this._config = clone(result.config);
      this._loaded = true;
      this._dirty = false;
      this._saveStatus = "saved";
      this._changeVersion = 0;
      this._selectedNodeId = this._config.nodes?.find((node) => node.id === "kitchen_breaker")?.id
        || this._config.nodes?.find((node) => node.type === "breaker")?.id
        || null;
      this._inspectorOpen = window.innerWidth > 900;
      this._renderAll();
      this.shadowRoot.getElementById("loading").style.display = "none";
    } catch (error) {
      const loading = this.shadowRoot.getElementById("loading");
      loading.innerHTML = `
        <div class="loading-card">
          <ha-icon icon="mdi:alert-circle-outline" style="color:var(--en-danger);--mdc-icon-size:40px"></ha-icon>
          <div>Не удалось загрузить электросхему</div>
          <div style="max-width:520px;text-align:center;font-size:12px">${escapeHtml(error?.message || error)}</div>
          <button class="btn" data-action="reload-config">Повторить</button>
        </div>`;
    } finally {
      this._loading = false;
    }
  }

  _renderAll() {
    if (!this._config) return;
    this._rebuildGraphCache();
    if (this._selectedNodeId && !this._nodeById.has(this._selectedNodeId)) this._selectedNodeId = null;
    if (this._selectedEdgeId && !(this._config.edges || []).some((edge) => edge.id === this._selectedEdgeId)) this._selectedEdgeId = null;
    this._clearLiveCaches();
    this.shadowRoot.getElementById("page-title").textContent = this._config.title || "Электросхема дома";
    this._renderToolbar();
    this._renderSummary();
    this._renderSurfaceSize();
    this._renderNodes();
    this._renderEdges();
    this._renderInspector();
    this._renderEntityList();
    this._applyViewport();
  }

  _renderToolbar() {
    const toolbar = this.shadowRoot.getElementById("toolbar");
    const admin = this._isAdmin();
    const disabled = admin ? "" : "disabled";
    toolbar.innerHTML = `
      <button class="btn primary" data-action="add-board" ${disabled} title="Добавить распределительный щит">
        <ha-icon icon="mdi:plus"></ha-icon><span class="btn-text">Добавить щит</span>
      </button>
      <button class="btn" data-action="add-breaker" ${disabled} title="Добавить автоматический выключатель">
        <ha-icon icon="mdi:electric-switch"></ha-icon><span class="btn-text">Добавить автомат</span>
      </button>
      <button class="btn secondary-action" data-action="add-node-menu" ${disabled} title="Добавить другой тип узла">
        <ha-icon icon="mdi:shape-square-rounded-plus"></ha-icon><span class="btn-text hide-mid">Добавить узел</span>
      </button>
      <button class="btn ${this._connectMode ? "active" : ""}" data-action="connect" ${disabled || !this._editing ? "disabled" : ""} title="Соединить два узла">
        <ha-icon icon="mdi:link-variant-plus"></ha-icon><span class="btn-text hide-mid">Связать</span>
      </button>
      <button class="btn ${this._editing ? "active" : ""}" data-action="toggle-edit" ${disabled} title="Режим редактирования">
        <ha-icon icon="mdi:${this._editing ? "check" : "pencil"}"></ha-icon><span class="btn-text">${this._editing ? "Готово" : "Редактировать"}</span>
      </button>
      <button class="btn secondary-action" data-action="auto-layout" ${disabled} title="Автоматически выстроить схему">
        <ha-icon icon="mdi:graph-outline"></ha-icon><span class="btn-text hide-mid">Выстроить</span>
      </button>
      <button class="btn secondary-action" data-action="save" ${disabled || !this._dirty ? "disabled" : ""} title="Сохранить (Ctrl+S)">
        <ha-icon icon="mdi:content-save-outline"></ha-icon><span class="btn-text hide-mid">Сохранить</span>
      </button>
      <div class="save-state ${this._saveStatus === "error" ? "error" : this._dirty ? "dirty" : ""}" id="save-state">
        <span class="dot"></span><span>${this._saveStatusText()}</span>
      </div>
      ${admin ? "" : '<span class="readonly-note">Только просмотр</span>'}
      <details class="more">
        <summary class="icon-btn" title="Дополнительные действия"><ha-icon icon="mdi:dots-vertical"></ha-icon></summary>
        <div class="menu">
          <button class="menu-item" data-action="settings"><ha-icon icon="mdi:tune-variant"></ha-icon>Настройки схемы</button>
          <button class="menu-item" data-action="fit"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon>Показать всю схему</button>
          <button class="menu-item" data-action="export"><ha-icon icon="mdi:download-outline"></ha-icon>Экспорт JSON</button>
          <button class="menu-item" data-action="import" ${disabled}><ha-icon icon="mdi:upload-outline"></ha-icon>Импорт JSON</button>
          <div class="menu-sep"></div>
          <button class="menu-item" data-action="reset-demo" ${disabled}><ha-icon icon="mdi:restore"></ha-icon>Вернуть демо-схему</button>
        </div>
      </details>
    `;
  }

  _saveStatusText() {
    if (this._saveStatus === "saving") return "Сохранение…";
    if (this._saveStatus === "error") return "Ошибка";
    if (this._dirty) return "Не сохранено";
    return "Сохранено";
  }

  _updateSaveState() {
    const state = this.shadowRoot.getElementById("save-state");
    if (!state) return;
    state.className = `save-state ${this._saveStatus === "error" ? "error" : this._dirty ? "dirty" : ""}`;
    const label = state.querySelector("span:last-child");
    if (label) label.textContent = this._saveStatusText();
    const saveButton = this.shadowRoot.querySelector('[data-action="save"]');
    if (saveButton) saveButton.disabled = !this._isAdmin() || !this._dirty || this._saveStatus === "saving";
  }

  _renderEntityList() {
    if (!this._hass?.states) return;
    const list = this.shadowRoot.getElementById("entity-list");
    const entityIds = Object.keys(this._hass.states).sort();
    const signature = `${entityIds.length}:${entityIds[0] || ""}:${entityIds.at(-1) || ""}`;
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    list.innerHTML = entityIds
      .slice(0, 10000)
      .map((entityId) => {
        const friendly = this._hass.states[entityId]?.attributes?.friendly_name || "";
        return `<option value="${escapeHtml(entityId)}">${escapeHtml(friendly)}</option>`;
      })
      .join("");
  }

  _rebuildGraphCache() {
    this._nodeById = new Map((this._config.nodes || []).map((node) => [node.id, node]));
    this._outgoing = new Map();
    this._incoming = new Map();
    for (const node of this._config.nodes || []) {
      this._outgoing.set(node.id, []);
      this._incoming.set(node.id, []);
    }
    for (const edge of this._config.edges || []) {
      if (this._outgoing.has(edge.source)) this._outgoing.get(edge.source).push(edge);
      if (this._incoming.has(edge.target)) this._incoming.get(edge.target).push(edge);
    }
  }

  _clearLiveCaches() {
    this._metricCache.clear();
    this._subtreeCache.clear();
  }

  _stateObject(entityId) {
    if (!entityId || !this._hass?.states) return null;
    return this._hass.states[entityId] || null;
  }

  _stateInfo(entityId) {
    const object = this._stateObject(entityId);
    if (!object) return { exists: false, unavailable: false, on: null, raw: null };
    const raw = String(object.state ?? "").trim().toLowerCase();
    if (UNAVAILABLE_STATES.has(raw)) return { exists: true, unavailable: true, on: null, raw };
    return { exists: true, unavailable: false, on: !OFF_STATES.has(raw), raw };
  }

  _convertMetric(value, unit, key) {
    if (value == null) return null;
    const rawUnit = String(unit || "").trim().replaceAll(" ", "");
    const normalizedUnit = rawUnit.toLowerCase();
    if (key === "power") {
      if (rawUnit === "mW") return value / 1000;
      if (rawUnit === "MW") return value * 1000000;
      if (["kw", "квт"].includes(normalizedUnit)) return value * 1000;
      if (["мвт"].includes(normalizedUnit)) return value * 1000000;
      return value;
    }
    if (key === "current") {
      if (rawUnit === "mA") return value / 1000;
      if (["ma", "ма"].includes(normalizedUnit)) return value / 1000;
      if (["ka", "ка"].includes(normalizedUnit)) return value * 1000;
      return value;
    }
    if (key === "voltage") {
      if (rawUnit === "mV") return value / 1000;
      if (["mv", "мв"].includes(normalizedUnit)) return value / 1000;
      if (["kv", "кв"].includes(normalizedUnit)) return value * 1000;
      return value;
    }
    if (key === "energy") {
      if (rawUnit === "mWh") return value / 1000000;
      if (["wh", "вт⋅ч", "вт·ч", "втч"].includes(normalizedUnit)) return value / 1000;
      if (rawUnit === "MWh" || ["мвт⋅ч", "мвт·ч"].includes(normalizedUnit)) return value * 1000;
      return value;
    }
    if (key === "frequency") {
      if (["khz", "кгц"].includes(normalizedUnit)) return value * 1000;
      return value;
    }
    return value;
  }

  _metricFromEntity(entityId, key) {
    const state = this._stateObject(entityId);
    if (!state || UNAVAILABLE_STATES.has(String(state.state ?? "").trim().toLowerCase())) return null;
    const number = parseNumber(state.state);
    if (number == null) return null;
    return this._convertMetric(number, state.attributes?.unit_of_measurement, key);
  }

  _metric(node, key) {
    if (!node) return null;
    const cacheKey = `${node.id}:${key}`;
    if (this._metricCache.has(cacheKey)) return this._metricCache.get(cacheKey);
    const entityId = node.entities?.[key] || "";
    let value = this._metricFromEntity(entityId, key);
    if (value == null && this._config.settings?.demo_mode && node.demo?.[key] != null) {
      value = Number(node.demo[key]);
    }
    if (!Number.isFinite(value)) value = null;
    this._metricCache.set(cacheKey, value);
    return value;
  }

  _nodeState(node) {
    const entityId = node?.entities?.state || "";
    const info = this._stateInfo(entityId);
    if (info.exists) return info;
    if (this._config.settings?.demo_mode && node?.demo?.state != null) {
      const raw = String(node.demo.state).trim().toLowerCase();
      return { exists: false, unavailable: false, on: !OFF_STATES.has(raw) && !UNAVAILABLE_STATES.has(raw), raw };
    }
    return { exists: false, unavailable: false, on: null, raw: null };
  }

  _subtreePower(nodeId, visiting = new Set()) {
    const cacheKey = `power:${nodeId}`;
    if (this._subtreeCache.has(cacheKey)) return this._subtreeCache.get(cacheKey);
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const node = this._nodeById.get(nodeId);
    const own = this._metric(node, "power");
    let value = own;
    if (value == null) {
      value = 0;
      for (const edge of this._outgoing.get(nodeId) || []) {
        if (!edge.disabled) value += Math.max(0, this._subtreePower(edge.target, visiting));
      }
    }
    visiting.delete(nodeId);
    this._subtreeCache.set(cacheKey, value ?? 0);
    return value ?? 0;
  }

  _subtreeEnergized(nodeId, visiting = new Set()) {
    const cacheKey = `energized:${nodeId}`;
    if (this._subtreeCache.has(cacheKey)) return this._subtreeCache.get(cacheKey);
    if (visiting.has(nodeId)) return false;
    visiting.add(nodeId);
    const node = this._nodeById.get(nodeId);
    const state = this._nodeState(node);
    let value = state.on;
    if (value == null) {
      const threshold = Number(this._config.settings?.flow_threshold_w ?? 3);
      value = Math.abs(this._subtreePower(nodeId)) > threshold;
      if (!value) {
        value = (this._outgoing.get(nodeId) || []).some(
          (edge) => !edge.disabled && this._subtreeEnergized(edge.target, visiting)
        );
      }
      if (!value && ["source", "board", "junction"].includes(node?.type)) value = true;
    }
    visiting.delete(nodeId);
    this._subtreeCache.set(cacheKey, Boolean(value));
    return Boolean(value);
  }

  _summaryMetric(key) {
    const entityId = this._config.settings?.summary_entities?.[key] || "";
    let value = this._metricFromEntity(entityId, key);
    if (value != null) return value;

    if (key === "power") {
      const sources = (this._config.nodes || []).filter((node) => node.type === "source");
      if (sources.length) {
        const sourceValue = this._metric(sources[0], "power");
        if (sourceValue != null) return sourceValue;
        return this._subtreePower(sources[0].id);
      }
      return (this._config.nodes || [])
        .filter((node) => node.type === "load")
        .reduce((sum, node) => sum + (this._metric(node, "power") || 0), 0);
    }

    const sources = (this._config.nodes || []).filter((node) => node.type === "source");
    if (sources.length) {
      const sourceValue = this._metric(sources[0], key);
      if (sourceValue != null) return sourceValue;
    }

    if (this._config.settings?.demo_mode) {
      const demo = Number(this._config.settings?.summary_demo?.[key]);
      if (Number.isFinite(demo)) return demo;
    }
    return null;
  }

  _formatMetric(value, key, compact = false) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    const number = Number(value);
    if (key === "power") {
      if (Math.abs(number) >= 1000000) return `${round(number / 1000000, 2)} МВт`;
      if (Math.abs(number) >= 1000) return `${round(number / 1000, compact ? 1 : 2)} кВт`;
      return `${round(number, compact ? 0 : 1)} Вт`;
    }
    if (key === "current") return `${round(number, compact ? 1 : 2)} A`;
    if (key === "voltage") return `${round(number, 1)} В`;
    if (key === "energy") return `${round(number, 2)} кВт·ч`;
    if (key === "frequency") return `${round(number, 1)} Гц`;
    if (key === "temperature") return `${round(number, 1)} °C`;
    return String(round(number, 2));
  }

  _phaseBalance() {
    const phases = {
      L1: { power: 0, current: 0 },
      L2: { power: 0, current: 0 },
      L3: { power: 0, current: 0 },
    };
    const leaves = (this._config.nodes || []).filter(
      (node) => node.type === "load" || (this._outgoing.get(node.id) || []).length === 0
    );
    for (const node of leaves) {
      if (!phases[node.phase]) continue;
      phases[node.phase].power += this._metric(node, "power") || 0;
      phases[node.phase].current += this._metric(node, "current") || 0;
    }
    return phases;
  }

  _renderSummary() {
    const summary = this.shadowRoot.getElementById("summary");
    if (!summary || !this._config) return;
    const power = this._summaryMetric("power");
    const energy = this._summaryMetric("energy");
    const current = this._summaryMetric("current");
    const voltage = this._summaryMetric("voltage");
    const frequency = this._summaryMetric("frequency");
    const phases = this._phaseBalance();
    const phaseCard = this._config.settings?.show_phase_balance
      ? `<div class="stat-card phase-card">
          <div class="stat-icon"><ha-icon icon="mdi:sine-wave"></ha-icon></div>
          <div><div class="label">Баланс фаз</div><div class="value" style="font-size:15px">L1 / L2 / L3</div></div>
          <div class="phases">
            ${["L1", "L2", "L3"].map((phase, index) => `
              <div class="phase" style="--phase-color:${["#4da9ff", "#50d890", "#a78bfa"][index]}">
                <div class="phase-name">${phase}</div>
                <div class="phase-value">${this._formatMetric(phases[phase].current, "current", true)}</div>
                <div class="phase-sub">${this._formatMetric(phases[phase].power, "power", true)}</div>
              </div>`).join("")}
          </div>
        </div>`
      : "";
    summary.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon"><ha-icon icon="mdi:lightning-bolt"></ha-icon></div>
        <div><div class="label">Общая нагрузка</div><div class="value">${this._formatMetric(power, "power")}</div></div>
        <div class="sub"><span>I ${this._formatMetric(current, "current")}</span><span>U ${this._formatMetric(voltage, "voltage")}</span><span>f ${this._formatMetric(frequency, "frequency")}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><ha-icon icon="mdi:chart-histogram"></ha-icon></div>
        <div><div class="label">Энергия сегодня</div><div class="value">${this._formatMetric(energy, "energy")}</div></div>
      </div>
      ${phaseCard}
      ${this._config.settings?.demo_mode ? '<div class="demo-badge">Демо-данные для несвязанных сущностей</div>' : ""}
    `;
  }

  _renderSurfaceSize() {
    const nodes = this._config.nodes || [];
    const maxX = Math.max(1600, ...nodes.map((node) => Number(node.x) + Number(node.w) + 260));
    const maxY = Math.max(1000, ...nodes.map((node) => Number(node.y) + Number(node.h) + 220));
    const minX = Math.min(0, ...nodes.map((node) => Number(node.x) - 160));
    const minY = Math.min(0, ...nodes.map((node) => Number(node.y) - 160));
    const width = Math.min(12000, maxX - minX);
    const height = Math.min(12000, maxY - minY);
    const surface = this.shadowRoot.getElementById("surface");
    const svg = this.shadowRoot.getElementById("edge-layer");
    surface.style.width = `${width}px`;
    surface.style.height = `${height}px`;
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const canvas = this.shadowRoot.getElementById("canvas");
    canvas.classList.toggle("show-grid", Boolean(this._config.settings?.show_grid));
    const size = Number(this._config.settings?.grid_size || 20);
    canvas.style.backgroundSize = `${size * (this._config.viewport?.zoom || 1)}px ${size * (this._config.viewport?.zoom || 1)}px`;
  }

  _applyViewport() {
    if (!this._config?.viewport) return;
    const { x = 0, y = 0, zoom = 1 } = this._config.viewport;
    const surface = this.shadowRoot.getElementById("surface");
    surface.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    const canvas = this.shadowRoot.getElementById("canvas");
    const grid = Number(this._config.settings?.grid_size || 20) * zoom;
    canvas.style.backgroundSize = `${grid}px ${grid}px`;
    canvas.style.backgroundPosition = `${x}px ${y}px`;
  }

  _nodeSupplied(nodeId, visiting = new Set()) {
    const cacheKey = `supplied:${nodeId}`;
    if (this._subtreeCache.has(cacheKey)) return this._subtreeCache.get(cacheKey);
    if (visiting.has(nodeId)) return false;
    visiting.add(nodeId);
    const node = this._nodeById.get(nodeId);
    if (!node) {
      visiting.delete(nodeId);
      return false;
    }
    const state = this._nodeState(node);
    let supplied;
    if (state.unavailable || state.on === false) {
      supplied = false;
    } else if (node.type === "source") {
      supplied = state.on !== false;
    } else {
      const incoming = (this._incoming.get(nodeId) || []).filter((edge) => !edge.disabled);
      supplied = incoming.some((edge) => {
        const edgeState = this._stateInfo(edge.entities?.state || "");
        if (edgeState.unavailable || edgeState.on === false) return false;
        return this._nodeSupplied(edge.source, visiting);
      });
      if (!incoming.length && state.on === true) supplied = true;
      if (!incoming.length && Math.abs(this._metric(node, "power") || 0) > Number(this._config.settings?.flow_threshold_w ?? 3)) supplied = true;
    }
    visiting.delete(nodeId);
    this._subtreeCache.set(cacheKey, Boolean(supplied));
    return Boolean(supplied);
  }

  _nodeStatus(node) {
    const state = this._nodeState(node);
    const power = this._subtreePower(node.id);
    const threshold = Number(this._config.settings?.flow_threshold_w ?? 3);
    const energized = this._nodeSupplied(node.id);
    return {
      energized,
      flowing: energized && Math.abs(power) > threshold,
      unavailable: state.unavailable,
      power,
    };
  }

  _primaryEntity(node) {
    return node.entities?.state || node.entities?.power || node.entities?.current || "";
  }

  _nodeTypeLabel(node) {
    const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.load;
    if (node.type === "breaker" && node.nominal) return `${meta.label} ${node.nominal}`;
    if (node.type === "rcd" && node.nominal) return `${meta.label} ${node.nominal}`;
    if (node.type === "source") return "Источник питания";
    return meta.label;
  }

  _nodeHtml(node) {
    const status = this._nodeStatus(node);
    const selected = this._selectedNodeId === node.id;
    const connectSource = this._connectFrom === node.id;
    const classes = [
      "diagram-node",
      `type-${node.type}`,
      node.type === "board" ? "board" : "",
      selected ? "selected" : "",
      connectSource ? "connect-source" : "",
      status.energized ? "energized" : "inactive",
      status.unavailable ? "unavailable" : "",
      Number(node.w) < 280 ? "compact" : "",
      node.parent_id ? "inside-board" : "",
    ].filter(Boolean).join(" ");
    const style = `left:${Number(node.x)}px;top:${Number(node.y)}px;width:${Number(node.w)}px;height:${Number(node.h)}px;z-index:${node.type === "board" ? 1 : node.parent_id ? 5 : 3}`;
    const icon = node.icon || NODE_TYPE_META[node.type]?.icon || "mdi:power-plug";

    if (node.type === "board") {
      const childCount = (this._config.nodes || []).filter((candidate) => candidate.parent_id === node.id).length;
      return `
        <div class="${classes}" data-node-id="${escapeHtml(node.id)}" style="${style}" title="${escapeHtml(node.description || node.name)}">
          <div class="board-header">
            <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
            <div class="board-title">${escapeHtml(node.name)}</div>
            <div class="board-count">${childCount} ${childCount === 1 ? "линия" : "линий"}</div>
          </div>
          <div class="board-bus"></div>
          <span class="status-dot"></span>
          <span class="port left"></span><span class="port right"></span><span class="port top"></span><span class="port bottom"></span>
        </div>`;
    }

    if (node.type === "junction") {
      return `
        <div class="${classes}" data-node-id="${escapeHtml(node.id)}" style="${style}" title="${escapeHtml(node.description || node.name)}">
          <div class="node-content" style="grid-template-columns:44px 1fr">
            <div class="node-icon" style="width:40px;height:40px"><ha-icon icon="${escapeHtml(icon)}"></ha-icon></div>
            <div class="node-info"><div class="node-name">${escapeHtml(node.name)}</div><div class="node-kind">${escapeHtml(this._nodeTypeLabel(node))}</div></div>
          </div>
          <span class="status-dot"></span>
          <span class="port left"></span><span class="port right"></span><span class="port top"></span><span class="port bottom"></span>
        </div>`;
    }

    const entity = this._primaryEntity(node);
    const nominal = node.nominal ? `<span class="nominal">${escapeHtml(node.nominal)}</span>` : "";
    return `
      <div class="${classes}" data-node-id="${escapeHtml(node.id)}" style="${style}" title="${escapeHtml(node.description || node.name)}">
        <div class="node-content">
          <div class="node-icon"><ha-icon icon="${escapeHtml(icon)}"></ha-icon></div>
          <div class="node-info">
            <div class="node-title-row"><div class="node-name">${escapeHtml(node.name)}</div>${nominal}</div>
            <div class="node-kind">${escapeHtml(this._nodeTypeLabel(node))}${node.phase && node.phase !== "all" ? ` · ${escapeHtml(node.phase)}` : ""}</div>
            <div class="entity-chip" title="${escapeHtml(entity || "Сущность не связана")}">${escapeHtml(entity || "Сущность не связана")}</div>
          </div>
          <div class="metric-grid">
            <span class="k">I</span><span class="v" data-node-live="${escapeHtml(node.id)}:current">${escapeHtml(this._formatMetric(this._metric(node, "current"), "current", true))}</span>
            <span class="k">P</span><span class="v" data-node-live="${escapeHtml(node.id)}:power">${escapeHtml(this._formatMetric(this._metric(node, "power"), "power", true))}</span>
            <span class="k">U</span><span class="v" data-node-live="${escapeHtml(node.id)}:voltage">${escapeHtml(this._formatMetric(this._metric(node, "voltage"), "voltage", true))}</span>
          </div>
        </div>
        <span class="status-dot"></span>
        <span class="port left"></span><span class="port right"></span><span class="port top"></span><span class="port bottom"></span>
      </div>`;
  }

  _renderNodes() {
    const layer = this.shadowRoot.getElementById("node-layer");
    const nodes = [...(this._config.nodes || [])].sort((a, b) => {
      if (a.type === "board" && b.type !== "board") return -1;
      if (a.type !== "board" && b.type === "board") return 1;
      return Number(a.y) - Number(b.y);
    });
    layer.className = `node-layer ${this._editing ? "edit-mode" : ""} ${this._connectMode ? "connect-mode" : ""}`;
    layer.innerHTML = nodes.map((node) => this._nodeHtml(node)).join("");
  }

  _resolvePort(node, port, otherNode, isSource) {
    if (port && port !== "auto") return port;
    if (isSource && node.type === "board" && otherNode?.parent_id === node.id) return "left";
    const sourceCenter = { x: Number(node.x) + Number(node.w) / 2, y: Number(node.y) + Number(node.h) / 2 };
    const otherCenter = { x: Number(otherNode.x) + Number(otherNode.w) / 2, y: Number(otherNode.y) + Number(otherNode.h) / 2 };
    const dx = otherCenter.x - sourceCenter.x;
    const dy = otherCenter.y - sourceCenter.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "bottom" : "top";
  }

  _portPoint(node, port, otherNode, isSource) {
    const resolved = this._resolvePort(node, port, otherNode, isSource);
    if (isSource && node.type === "board" && otherNode?.parent_id === node.id && (!port || port === "auto")) {
      return { x: Number(node.x) + 18, y: Number(otherNode.y) + Number(otherNode.h) / 2, port: "left" };
    }
    const x = Number(node.x);
    const y = Number(node.y);
    const w = Number(node.w);
    const h = Number(node.h);
    if (resolved === "left") return { x, y: y + h / 2, port: resolved };
    if (resolved === "right") return { x: x + w, y: y + h / 2, port: resolved };
    if (resolved === "top") return { x: x + w / 2, y, port: resolved };
    return { x: x + w / 2, y: y + h, port: "bottom" };
  }

  _roundedPath(points, radius = 14) {
    const filtered = points.filter((point, index) => {
      if (!index) return true;
      const previous = points[index - 1];
      return Math.abs(point.x - previous.x) > 0.001 || Math.abs(point.y - previous.y) > 0.001;
    });
    if (filtered.length < 2) return "";
    let path = `M ${round(filtered[0].x, 2)} ${round(filtered[0].y, 2)}`;
    for (let index = 1; index < filtered.length - 1; index += 1) {
      const previous = filtered[index - 1];
      const current = filtered[index];
      const next = filtered[index + 1];
      const incoming = Math.hypot(current.x - previous.x, current.y - previous.y);
      const outgoing = Math.hypot(next.x - current.x, next.y - current.y);
      if (incoming < 0.001 || outgoing < 0.001) continue;
      const localRadius = Math.min(radius, incoming / 2, outgoing / 2);
      const before = {
        x: current.x + ((previous.x - current.x) / incoming) * localRadius,
        y: current.y + ((previous.y - current.y) / incoming) * localRadius,
      };
      const after = {
        x: current.x + ((next.x - current.x) / outgoing) * localRadius,
        y: current.y + ((next.y - current.y) / outgoing) * localRadius,
      };
      path += ` L ${round(before.x, 2)} ${round(before.y, 2)} Q ${round(current.x, 2)} ${round(current.y, 2)} ${round(after.x, 2)} ${round(after.y, 2)}`;
    }
    const last = filtered.at(-1);
    path += ` L ${round(last.x, 2)} ${round(last.y, 2)}`;
    return path;
  }

  _edgeGeometry(edge) {
    const source = this._nodeById.get(edge.source);
    const target = this._nodeById.get(edge.target);
    if (!source || !target) return null;
    const start = this._portPoint(source, edge.source_port, target, true);
    const end = this._portPoint(target, edge.target_port, source, false);
    const horizontalStart = ["left", "right"].includes(start.port);
    const horizontalEnd = ["left", "right"].includes(end.port);
    let points;

    if (horizontalStart && horizontalEnd) {
      const midX = (start.x + end.x) / 2;
      points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    } else if (!horizontalStart && !horizontalEnd) {
      const midY = (start.y + end.y) / 2;
      points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
    } else if (horizontalStart) {
      const offsetX = start.port === "right" ? 38 : -38;
      points = [start, { x: start.x + offsetX, y: start.y }, { x: start.x + offsetX, y: end.y }, end];
    } else {
      const offsetY = start.port === "bottom" ? 38 : -38;
      points = [start, { x: start.x, y: start.y + offsetY }, { x: end.x, y: start.y + offsetY }, end];
    }

    const middle = points[Math.floor(points.length / 2)];
    return { path: this._roundedPath(points), labelX: middle.x + 6, labelY: middle.y - 7 };
  }

  _edgeStatus(edge) {
    if (edge.disabled) return { energized: false, flowing: false, unavailable: false, power: 0 };
    const stateInfo = this._stateInfo(edge.entities?.state || "");
    let power = this._metricFromEntity(edge.entities?.power || "", "power");
    if (power == null) power = this._subtreePower(edge.target);
    const threshold = Number(this._config.settings?.flow_threshold_w ?? 3);
    const sourceSupplied = this._nodeSupplied(edge.source);
    const energized = sourceSupplied && !stateInfo.unavailable && stateInfo.on !== false;
    return {
      energized,
      flowing: energized && Math.abs(power) > threshold,
      unavailable: stateInfo.unavailable,
      power: Number(power) || 0,
    };
  }

  _renderEdges() {
    const layer = this.shadowRoot.getElementById("edge-layer");
    if (!layer || !this._config) return;
    layer.innerHTML = (this._config.edges || []).map((edge) => {
      const geometry = this._edgeGeometry(edge);
      if (!geometry) return "";
      const status = this._edgeStatus(edge);
      const selected = this._selectedEdgeId === edge.id;
      const classes = [
        "edge",
        status.energized ? "energized" : "off",
        status.flowing ? "flowing" : "",
        status.unavailable ? "unavailable" : "",
        selected ? "selected" : "",
      ].filter(Boolean).join(" ");
      const duration = clamp(3.2 - Math.log10(Math.max(Math.abs(status.power), 1)) * 0.62, 0.65, 3.2);
      const label = edge.label
        ? `<text class="edge-label" x="${round(geometry.labelX, 2)}" y="${round(geometry.labelY, 2)}">${escapeHtml(edge.label)}</text>`
        : "";
      return `
        <g class="${classes}" data-edge-group="${escapeHtml(edge.id)}" style="--flow-duration:${round(duration, 2)}s">
          <path class="wire-glow" d="${geometry.path}"></path>
          <path class="wire-base" d="${geometry.path}"></path>
          <path class="wire-dots" d="${geometry.path}"></path>
          ${label}
          <path class="edge-hit" data-edge-id="${escapeHtml(edge.id)}" d="${geometry.path}"></path>
        </g>`;
    }).join("");
  }

  _statusLabel(status) {
    if (status.unavailable) return "Недоступно";
    if (status.energized) return status.flowing ? "Есть нагрузка" : "Под напряжением";
    return "Отключено";
  }

  _parentName(node) {
    return node.parent_id ? this._nodeById.get(node.parent_id)?.name || node.parent_id : "Вне щита";
  }

  _controlEntity(node) {
    const entityId = node?.entities?.state || "";
    const domain = entityId.split(".")[0];
    return ["switch", "light", "input_boolean", "fan"].includes(domain) ? entityId : "";
  }

  _renderLiveRows(node) {
    return ["current", "power", "voltage", "energy", "frequency", "temperature"]
      .map((key) => `
        <div class="read-row">
          <div class="read-key">${METRIC_LABELS[key]}</div>
          <div class="read-value" data-inspector-live="${key}">${escapeHtml(this._formatMetric(this._metric(node, key), key))}</div>
        </div>`)
      .join("");
  }

  _entityEditor(node, key) {
    const value = node.entities?.[key] || "";
    return `
      <div class="entity-field">
        <span class="entity-label">${METRIC_LABELS[key] || "Состояние"}</span>
        <input value="${escapeHtml(value)}" list="entity-list" data-node-entity="${key}" placeholder="sensor.example_${key}">
        <button class="mini-action" data-action="show-entity" data-entity="${escapeHtml(value)}" title="Открыть сущность" ${value ? "" : "disabled"}><ha-icon icon="mdi:open-in-new"></ha-icon></button>
      </div>`;
  }

  _renderInspector() {
    const inspector = this.shadowRoot.getElementById("inspector");
    if (!inspector || !this._config) return;
    inspector.classList.toggle("open", this._inspectorOpen);
    this.shadowRoot.getElementById("main-layout")?.classList.toggle("inspector-closed", !this._inspectorOpen);
    if (this._selectedNodeId && this._nodeById.has(this._selectedNodeId)) {
      this._renderNodeInspector(this._nodeById.get(this._selectedNodeId));
      return;
    }
    const edge = (this._config.edges || []).find((item) => item.id === this._selectedEdgeId);
    if (edge) {
      this._renderEdgeInspector(edge);
      return;
    }
    this._renderSettingsInspector();
  }

  _renderNodeInspector(node) {
    const inspector = this.shadowRoot.getElementById("inspector");
    const status = this._nodeStatus(node);
    const admin = this._isAdmin();
    const canEdit = admin && this._editing;
    const controlEntity = this._controlEntity(node);
    const stateInfo = this._stateInfo(controlEntity);
    const boardOptions = (this._config.nodes || [])
      .filter((candidate) => candidate.type === "board" && candidate.id !== node.id)
      .map((candidate) => `<option value="${escapeHtml(candidate.id)}" ${candidate.id === node.parent_id ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`)
      .join("");
    const typeOptions = Object.entries(NODE_TYPE_META)
      .map(([type, meta]) => `<option value="${type}" ${type === node.type ? "selected" : ""}>${escapeHtml(meta.label)}</option>`)
      .join("");
    const phaseOptions = ["all", "L1", "L2", "L3", "N", "DC"]
      .map((phase) => `<option value="${phase}" ${phase === node.phase ? "selected" : ""}>${phase === "all" ? "Все фазы" : phase}</option>`)
      .join("");

    const properties = canEdit
      ? `<div class="section">
          <h3 class="section-title">Свойства узла</h3>
          <div class="form-grid">
            <div class="field two">
              <label class="field">Тип
                <select data-node-field="type">${typeOptions}</select>
              </label>
              <label class="field">Фаза
                <select data-node-field="phase">${phaseOptions}</select>
              </label>
            </div>
            <label class="field">Название
              <input value="${escapeHtml(node.name)}" data-node-field="name" maxlength="120">
            </label>
            <label class="field">Номинал
              <input value="${escapeHtml(node.nominal || "")}" data-node-field="nominal" placeholder="16 A / 30 mA">
            </label>
            <label class="field">Описание
              <textarea data-node-field="description" maxlength="500">${escapeHtml(node.description || "")}</textarea>
            </label>
            <label class="field">Иконка MDI
              <input value="${escapeHtml(node.icon || "")}" data-node-field="icon" placeholder="mdi:electric-switch">
            </label>
            <label class="field">Расположение
              <select data-node-field="parent_id"><option value="">Вне щита</option>${boardOptions}</select>
            </label>
            <div class="field two">
              <label class="field">Ширина
                <input type="number" min="100" max="1500" step="10" value="${round(node.w, 0)}" data-node-number="w">
              </label>
              <label class="field">Высота
                <input type="number" min="60" max="1500" step="10" value="${round(node.h, 0)}" data-node-number="h">
              </label>
            </div>
          </div>
        </div>`
      : `<div class="section">
          <h3 class="section-title">Свойства</h3>
          <div class="read-row"><div class="read-key">Тип устройства</div><div class="read-value">${escapeHtml(this._nodeTypeLabel(node))}</div></div>
          <div class="read-row"><div class="read-key">Номинал</div><div class="read-value">${escapeHtml(node.nominal || "—")}</div></div>
          <div class="read-row"><div class="read-key">Фаза</div><div class="read-value">${escapeHtml(node.phase || "—")}</div></div>
          <div class="read-row"><div class="read-key">Щит</div><div class="read-value">${escapeHtml(this._parentName(node))}</div></div>
          <div class="read-row"><div class="read-key">Описание</div><div class="read-value">${escapeHtml(node.description || "—")}</div></div>
        </div>`;

    const entities = canEdit
      ? `<div class="section">
          <h3 class="section-title">Связанные сущности Home Assistant</h3>
          <div class="form-grid">
            ${ENTITY_KEYS.map((key) => this._entityEditor(node, key)).join("")}
          </div>
        </div>`
      : `<div class="section">
          <h3 class="section-title">Связанные сущности</h3>
          ${ENTITY_KEYS.filter((key) => node.entities?.[key]).map((key) => `
            <div class="read-row">
              <div class="read-key">${METRIC_LABELS[key] || "Состояние"}</div>
              <button class="read-value" style="border:0;background:none;color:var(--en-accent);cursor:pointer;padding:0" data-action="show-entity" data-entity="${escapeHtml(node.entities[key])}">${escapeHtml(node.entities[key])}</button>
            </div>`).join("") || '<div style="color:var(--en-muted);font-size:12px">Сущности пока не связаны.</div>'}
        </div>`;

    const controlSection = controlEntity
      ? `<div class="section">
          <h3 class="section-title">Управление</h3>
          ${this._config.settings?.allow_control
            ? `<div class="button-row">
                <button class="btn" data-action="turn-on" data-entity="${escapeHtml(controlEntity)}" ${stateInfo.on === true ? "disabled" : ""}><ha-icon icon="mdi:power"></ha-icon>Включить</button>
                <button class="btn danger" data-action="turn-off" data-entity="${escapeHtml(controlEntity)}" ${stateInfo.on === false ? "disabled" : ""}><ha-icon icon="mdi:power-off"></ha-icon>Отключить</button>
              </div>`
            : '<div class="warning-box">Управление сущностями отключено в настройках схемы. Это защищает от случайного отключения оборудования.</div>'}
        </div>`
      : "";

    inspector.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-icon"><ha-icon icon="${escapeHtml(node.icon || NODE_TYPE_META[node.type]?.icon)}"></ha-icon></div>
        <div class="inspector-heading">
          <h2>${escapeHtml(node.name)}</h2>
          <span class="status-pill ${status.energized ? "" : "off"}"><span class="dot"></span>${escapeHtml(this._statusLabel(status))}</span>
        </div>
        <button class="icon-btn" data-action="close-inspector" title="Закрыть"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="inspector-body">
        ${properties}
        ${entities}
        <div class="section">
          <h3 class="section-title">Текущие показатели</h3>
          ${this._renderLiveRows(node)}
          <div class="read-row"><div class="read-key">Состояние</div><div class="read-value" data-inspector-status>${escapeHtml(this._statusLabel(status))}</div></div>
        </div>
        ${controlSection}
        ${canEdit ? `<div class="section">
          <div class="button-row">
            <button class="btn" data-action="duplicate-node"><ha-icon icon="mdi:content-duplicate"></ha-icon>Дублировать</button>
            <button class="btn danger" data-action="delete-node"><ha-icon icon="mdi:delete-outline"></ha-icon>Удалить</button>
          </div>
        </div>` : ""}
      </div>`;
  }

  _renderEdgeInspector(edge) {
    const inspector = this.shadowRoot.getElementById("inspector");
    const status = this._edgeStatus(edge);
    const admin = this._isAdmin();
    const canEdit = admin && this._editing;
    const nodeOptions = (selectedId) => (this._config.nodes || [])
      .map((node) => `<option value="${escapeHtml(node.id)}" ${node.id === selectedId ? "selected" : ""}>${escapeHtml(node.name)}</option>`)
      .join("");
    const portOptions = (selected) => ["auto", "left", "right", "top", "bottom"]
      .map((port) => `<option value="${port}" ${port === selected ? "selected" : ""}>${{auto:"Авто",left:"Слева",right:"Справа",top:"Сверху",bottom:"Снизу"}[port]}</option>`)
      .join("");
    const sourceName = this._nodeById.get(edge.source)?.name || edge.source;
    const targetName = this._nodeById.get(edge.target)?.name || edge.target;

    const body = canEdit
      ? `<div class="section">
          <h3 class="section-title">Соединение</h3>
          <div class="form-grid">
            <label class="field">Откуда
              <select data-edge-field="source">${nodeOptions(edge.source)}</select>
            </label>
            <label class="field">Куда
              <select data-edge-field="target">${nodeOptions(edge.target)}</select>
            </label>
            <div class="field two">
              <label class="field">Порт источника
                <select data-edge-field="source_port">${portOptions(edge.source_port || "auto")}</select>
              </label>
              <label class="field">Порт назначения
                <select data-edge-field="target_port">${portOptions(edge.target_port || "auto")}</select>
              </label>
            </div>
            <label class="field">Подпись линии
              <input value="${escapeHtml(edge.label || "")}" data-edge-field="label" maxlength="100" placeholder="L1 / кабель 3×2.5">
            </label>
            <label class="switch-row">Линия отключена
              <input type="checkbox" data-edge-bool="disabled" ${edge.disabled ? "checked" : ""}>
            </label>
          </div>
        </div>
        <div class="section">
          <h3 class="section-title">Сущности линии</h3>
          <div class="form-grid">
            <div class="entity-field"><span class="entity-label">Состояние</span><input value="${escapeHtml(edge.entities?.state || "")}" list="entity-list" data-edge-entity="state"><button class="mini-action" data-action="show-entity" data-entity="${escapeHtml(edge.entities?.state || "")}" ${edge.entities?.state ? "" : "disabled"}><ha-icon icon="mdi:open-in-new"></ha-icon></button></div>
            <div class="entity-field"><span class="entity-label">Мощность</span><input value="${escapeHtml(edge.entities?.power || "")}" list="entity-list" data-edge-entity="power"><button class="mini-action" data-action="show-entity" data-entity="${escapeHtml(edge.entities?.power || "")}" ${edge.entities?.power ? "" : "disabled"}><ha-icon icon="mdi:open-in-new"></ha-icon></button></div>
          </div>
        </div>`
      : `<div class="section">
          <h3 class="section-title">Соединение</h3>
          <div class="read-row"><div class="read-key">Откуда</div><div class="read-value">${escapeHtml(sourceName)}</div></div>
          <div class="read-row"><div class="read-key">Куда</div><div class="read-value">${escapeHtml(targetName)}</div></div>
          <div class="read-row"><div class="read-key">Подпись</div><div class="read-value">${escapeHtml(edge.label || "—")}</div></div>
          <div class="read-row"><div class="read-key">Мощность</div><div class="read-value">${escapeHtml(this._formatMetric(status.power, "power"))}</div></div>
        </div>`;

    inspector.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-icon"><ha-icon icon="mdi:transit-connection-variant"></ha-icon></div>
        <div class="inspector-heading"><h2>${escapeHtml(sourceName)} → ${escapeHtml(targetName)}</h2><span class="status-pill ${status.energized ? "" : "off"}">${escapeHtml(this._statusLabel(status))}</span></div>
        <button class="icon-btn" data-action="close-inspector"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="inspector-body">
        ${body}
        ${canEdit ? `<div class="section"><div class="button-row"><button class="btn danger" data-action="delete-edge"><ha-icon icon="mdi:delete-outline"></ha-icon>Удалить соединение</button></div></div>` : ""}
      </div>`;
  }

  _summaryEntityEditor(key) {
    const value = this._config.settings?.summary_entities?.[key] || "";
    return `<div class="entity-field"><span class="entity-label">${METRIC_LABELS[key]}</span><input value="${escapeHtml(value)}" list="entity-list" data-summary-entity="${key}" placeholder="sensor.total_${key}"><button class="mini-action" data-action="show-entity" data-entity="${escapeHtml(value)}" ${value ? "" : "disabled"}><ha-icon icon="mdi:open-in-new"></ha-icon></button></div>`;
  }

  _renderSettingsInspector() {
    const inspector = this.shadowRoot.getElementById("inspector");
    const admin = this._isAdmin();
    const settings = this._config.settings || {};
    inspector.innerHTML = `
      <div class="inspector-header">
        <div class="inspector-icon"><ha-icon icon="mdi:tune-variant"></ha-icon></div>
        <div class="inspector-heading"><h2>Настройки схемы</h2><span class="status-pill">${(this._config.nodes || []).length} узлов · ${(this._config.edges || []).length} связей</span></div>
        <button class="icon-btn" data-action="close-inspector"><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="inspector-body">
        <div class="warning-box">Схема предназначена для мониторинга и управления сущностями Home Assistant. Она не заменяет электрический проект, расчёт защиты и проверку электриком.</div>
        <div class="section">
          <h3 class="section-title">Отображение</h3>
          <div class="form-grid">
            <label class="field">Название схемы<input value="${escapeHtml(this._config.title || "")}" data-config-field="title" maxlength="120" ${admin ? "" : "disabled"}></label>
            <label class="switch-row">Показывать сетку<input type="checkbox" data-setting-bool="show_grid" ${settings.show_grid ? "checked" : ""} ${admin ? "" : "disabled"}></label>
            <label class="switch-row">Показывать баланс фаз<input type="checkbox" data-setting-bool="show_phase_balance" ${settings.show_phase_balance ? "checked" : ""} ${admin ? "" : "disabled"}></label>
            <label class="field">Шаг сетки, px<input type="number" min="5" max="200" step="5" value="${Number(settings.grid_size || 20)}" data-setting-number="grid_size" ${admin ? "" : "disabled"}></label>
          </div>
        </div>
        <div class="section">
          <h3 class="section-title">Данные и поток</h3>
          <div class="form-grid">
            <label class="switch-row">Демо-значения для отсутствующих сущностей<input type="checkbox" data-setting-bool="demo_mode" ${settings.demo_mode ? "checked" : ""} ${admin ? "" : "disabled"}></label>
            <label class="switch-row">Автоматически сохранять изменения<input type="checkbox" data-setting-bool="auto_save" ${settings.auto_save ? "checked" : ""} ${admin ? "" : "disabled"}></label>
            <label class="field">Порог анимации, Вт<input type="number" min="0" max="1000000" step="1" value="${Number(settings.flow_threshold_w ?? 3)}" data-setting-number="flow_threshold_w" ${admin ? "" : "disabled"}></label>
          </div>
        </div>
        <div class="section">
          <h3 class="section-title">Итоговые показатели</h3>
          <div class="form-grid">${["power", "energy", "current", "voltage", "frequency"].map((key) => this._summaryEntityEditor(key)).join("")}</div>
        </div>
        <div class="section">
          <h3 class="section-title">Управление</h3>
          <label class="switch-row">Разрешить включение и отключение сущностей<input type="checkbox" data-setting-bool="allow_control" ${settings.allow_control ? "checked" : ""} ${admin ? "" : "disabled"}></label>
          <div class="warning-box" style="margin-top:8px">Команда отправляется только после подтверждения. Физические автоматы без управляемой сущности остаются информационными узлами.</div>
        </div>
        <div class="section">
          <div class="button-row">
            <button class="btn" data-action="export"><ha-icon icon="mdi:download-outline"></ha-icon>Экспорт</button>
            <button class="btn" data-action="import" ${admin ? "" : "disabled"}><ha-icon icon="mdi:upload-outline"></ha-icon>Импорт</button>
            <button class="btn danger" data-action="reset-demo" ${admin ? "" : "disabled"}><ha-icon icon="mdi:restore"></ha-icon>Сбросить</button>
          </div>
        </div>
      </div>`;
  }

  _selectedNode() {
    return this._selectedNodeId ? this._nodeById.get(this._selectedNodeId) || null : null;
  }

  _selectedEdge() {
    return this._selectedEdgeId
      ? (this._config.edges || []).find((edge) => edge.id === this._selectedEdgeId) || null
      : null;
  }

  _selectNode(nodeId) {
    if (!this._nodeById.has(nodeId)) return;
    if (this._connectMode) {
      this._handleConnectNode(nodeId);
      return;
    }
    this._selectedNodeId = nodeId;
    this._selectedEdgeId = null;
    this._inspectorOpen = true;
    this._renderNodes();
    this._renderEdges();
    this._renderInspector();
  }

  _selectEdge(edgeId) {
    if (!(this._config.edges || []).some((edge) => edge.id === edgeId)) return;
    this._selectedNodeId = null;
    this._selectedEdgeId = edgeId;
    this._inspectorOpen = true;
    this._renderNodes();
    this._renderEdges();
    this._renderInspector();
  }

  _selectSettings() {
    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._inspectorOpen = true;
    this._renderNodes();
    this._renderEdges();
    this._renderInspector();
  }

  _closeInspector() {
    this._inspectorOpen = false;
    this._renderInspector();
  }

  _closeOpenMenus() {
    for (const details of this.shadowRoot.querySelectorAll("details[open]")) details.removeAttribute("open");
  }

  async _onClick(event) {
    const actionTarget = event.target.closest?.("[data-action]");
    if (actionTarget) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionTarget.dataset.action;
      this._closeOpenMenus();
      try {
        await this._runAction(action, actionTarget);
      } catch (error) {
        console.error("Electrical Network action failed", error);
        this._toast(this._errorMessage(error), true);
      }
      return;
    }

    const nodeElement = event.target.closest?.("[data-node-id]");
    if (nodeElement && !this._didDrag) {
      this._selectNode(nodeElement.dataset.nodeId);
    }
    this._didDrag = false;
  }

  async _runAction(action, target) {
    switch (action) {
      case "reload-config":
        await this._reloadConfig(true);
        break;
      case "add-board":
        this._addNode("board");
        break;
      case "add-breaker":
        this._addNode("breaker");
        break;
      case "add-node-menu":
        this._showNodeTypeModal();
        break;
      case "add-node-type":
        this._closeModal();
        this._addNode(target.dataset.nodeType || "load");
        break;
      case "toggle-edit":
        this._toggleEdit();
        break;
      case "connect":
        this._toggleConnectMode();
        break;
      case "auto-layout":
        this._autoLayout();
        break;
      case "save":
        await this._save();
        break;
      case "settings":
        this._selectSettings();
        break;
      case "fit":
        this._fitToScreen();
        break;
      case "zoom-in":
        this._zoomBy(1.2);
        break;
      case "zoom-out":
        this._zoomBy(1 / 1.2);
        break;
      case "export":
        this._showExportModal();
        break;
      case "copy-export":
        await this._copyExport();
        break;
      case "download-export":
        this._downloadExport();
        break;
      case "import":
        this.shadowRoot.getElementById("import-file").click();
        break;
      case "apply-import":
        this._applyPendingImport();
        break;
      case "reset-demo":
        await this._resetDemo();
        break;
      case "close-inspector":
        this._closeInspector();
        break;
      case "close-modal":
        this._closeModal();
        break;
      case "show-entity":
        this._showEntity(target.dataset.entity || "");
        break;
      case "duplicate-node":
        this._duplicateSelectedNode();
        break;
      case "delete-node":
        this._deleteSelectedNode();
        break;
      case "delete-edge":
        this._deleteSelectedEdge();
        break;
      case "turn-on":
        await this._controlEntityAction(target.dataset.entity || "", true);
        break;
      case "turn-off":
        await this._controlEntityAction(target.dataset.entity || "", false);
        break;
      case "conflict-reload":
        this._closeModal();
        await this._reloadConfig(false);
        break;
      case "conflict-overwrite":
        this._closeModal();
        await this._save(true);
        break;
      default:
        break;
    }
  }

  _toggleEdit() {
    if (!this._isAdmin()) return;
    this._editing = !this._editing;
    if (!this._editing) {
      this._connectMode = false;
      this._connectFrom = null;
    }
    this._renderToolbar();
    this._renderNodes();
    this._renderInspector();
    this._toast(this._editing ? "Режим редактирования включён" : "Редактирование завершено");
  }

  _toggleConnectMode() {
    if (!this._isAdmin() || !this._editing) return;
    this._connectMode = !this._connectMode;
    this._connectFrom = null;
    this._renderToolbar();
    this._renderNodes();
    this._toast(this._connectMode ? "Выберите узел, от которого идёт питание" : "Соединение отменено");
  }

  _handleConnectNode(nodeId) {
    if (!this._connectFrom) {
      this._connectFrom = nodeId;
      this._selectedNodeId = nodeId;
      this._selectedEdgeId = null;
      this._renderNodes();
      this._renderInspector();
      this._toast("Теперь выберите узел назначения");
      return;
    }

    const source = this._connectFrom;
    const target = nodeId;
    if (source === target) {
      this._connectFrom = null;
      this._renderNodes();
      this._toast("Нельзя соединить узел с самим собой", true);
      return;
    }
    if ((this._config.edges || []).some((edge) => edge.source === source && edge.target === target)) {
      this._toast("Такое соединение уже существует", true);
      return;
    }
    if (this._wouldCreateCycle(source, target)) {
      this._toast("Соединение создаст замкнутый цикл. Оно не добавлено.", true);
      return;
    }

    const edge = {
      id: this._uniqueId(`edge_${source}_${target}`, new Set((this._config.edges || []).map((item) => item.id))),
      source,
      target,
      source_port: "auto",
      target_port: "auto",
      label: "",
      disabled: false,
      entities: { state: "", power: "" },
    };
    this._config.edges.push(edge);
    this._connectMode = false;
    this._connectFrom = null;
    this._selectedNodeId = null;
    this._selectedEdgeId = edge.id;
    this._inspectorOpen = true;
    this._afterStructureChange({ inspector: true });
    this._toast("Соединение добавлено");
  }

  _wouldCreateCycle(source, target, ignoredEdgeId = null) {
    if (source === target) return true;
    const adjacency = new Map((this._config.nodes || []).map((node) => [node.id, []]));
    for (const edge of this._config.edges || []) {
      if (edge.id === ignoredEdgeId) continue;
      if (adjacency.has(edge.source)) adjacency.get(edge.source).push(edge.target);
    }
    if (adjacency.has(source)) adjacency.get(source).push(target);
    const stack = [target];
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === source) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) || []) stack.push(next);
    }
    return false;
  }

  _uniqueId(base, existing) {
    let normalized = String(base || "item")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 54) || "item";
    if (!/^[a-z0-9]/.test(normalized)) normalized = `item_${normalized}`;
    let candidate = normalized;
    let counter = 2;
    while (existing.has(candidate)) {
      const suffix = `_${counter}`;
      candidate = `${normalized.slice(0, 64 - suffix.length)}${suffix}`;
      counter += 1;
    }
    existing.add(candidate);
    return candidate;
  }

  _diagramPointAtCanvasCenter() {
    const canvas = this.shadowRoot.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const viewport = this._config.viewport || { x: 0, y: 0, zoom: 1 };
    return {
      x: (rect.width / 2 - Number(viewport.x || 0)) / Number(viewport.zoom || 1),
      y: (rect.height / 2 - Number(viewport.y || 0)) / Number(viewport.zoom || 1),
    };
  }

  _addNode(type) {
    if (!this._isAdmin()) return;
    const meta = NODE_TYPE_META[type] || NODE_TYPE_META.load;
    const existing = new Set((this._config.nodes || []).map((node) => node.id));
    const typeCount = (this._config.nodes || []).filter((node) => node.type === type).length + 1;
    const id = this._uniqueId(`${type}_${typeCount}`, existing);
    const center = this._diagramPointAtCanvasCenter();
    const selectedBoard = this._selectedNode()?.type === "board" ? this._selectedNode() : null;
    const parentBoard = type === "board" ? null : selectedBoard;
    let x = center.x - meta.w / 2;
    let y = center.y - meta.h / 2;
    let width = meta.w;
    let height = meta.h;

    if (parentBoard) {
      const children = (this._config.nodes || []).filter((node) => node.parent_id === parentBoard.id);
      width = Math.max(180, Number(parentBoard.w) - 60);
      height = type === "junction" ? 86 : 112;
      x = Number(parentBoard.x) + 30;
      y = Number(parentBoard.y) + 74 + children.reduce((sum, child) => sum + Number(child.h) + 16, 0);
      const requiredHeight = y + height + 24 - Number(parentBoard.y);
      if (requiredHeight > Number(parentBoard.h)) parentBoard.h = Math.min(1500, requiredHeight);
    }

    const defaults = {
      source: { name: "Ввод", nominal: "", phase: "all" },
      breaker: { name: `Автомат ${typeCount}`, nominal: "16 A", phase: "L1" },
      rcd: { name: `УЗО ${typeCount}`, nominal: "40 A / 30 mA", phase: "all" },
      board: { name: `Распределительный щит ${typeCount}`, nominal: "", phase: "all" },
      load: { name: `Потребитель ${typeCount}`, nominal: "", phase: "L1" },
      meter: { name: `Счётчик ${typeCount}`, nominal: "", phase: "all" },
      junction: { name: `Соединение ${typeCount}`, nominal: "", phase: "all" },
    }[type];

    const node = {
      id,
      type,
      name: defaults.name,
      description: "",
      icon: meta.icon,
      x: round(x, 1),
      y: round(y, 1),
      w: width,
      h: height,
      phase: defaults.phase,
      nominal: defaults.nominal,
      parent_id: parentBoard?.id || "",
      entities: Object.fromEntries(ENTITY_KEYS.map((key) => [key, ""])),
      demo: { state: "on", power: 0, current: 0, voltage: 230 },
    };
    this._config.nodes.push(node);
    this._editing = true;
    this._selectedNodeId = node.id;
    this._selectedEdgeId = null;
    this._inspectorOpen = true;
    this._afterStructureChange({ inspector: true });
    this._toast(`${meta.label} добавлен`);
  }

  _showNodeTypeModal() {
    const options = Object.entries(NODE_TYPE_META)
      .map(([type, meta]) => `
        <button class="node-type-option" data-action="add-node-type" data-node-type="${type}">
          <ha-icon icon="${escapeHtml(meta.icon)}"></ha-icon>
          <span>${escapeHtml(meta.label)}</span>
        </button>`)
      .join("");
    this._openModal(
      "Добавить узел",
      `<div class="node-type-grid">${options}</div>
       <div class="warning-box" style="margin-top:14px">Щит — контейнер для аппаратов. Автомат, УЗО и потребитель можно связать с сущностями состояния, мощности, тока, напряжения и энергии.</div>`
    );
  }

  _descendantIds(rootId) {
    const ids = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of this._config.nodes || []) {
        if (node.parent_id && ids.has(node.parent_id) && !ids.has(node.id)) {
          ids.add(node.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  _duplicateSelectedNode() {
    if (!this._isAdmin() || !this._editing) return;
    const root = this._selectedNode();
    if (!root) return;
    const copiedIds = this._descendantIds(root.id);
    const existingNodeIds = new Set((this._config.nodes || []).map((node) => node.id));
    const idMap = new Map();
    for (const oldId of copiedIds) idMap.set(oldId, this._uniqueId(`${oldId}_copy`, existingNodeIds));

    const copies = (this._config.nodes || [])
      .filter((node) => copiedIds.has(node.id))
      .map((node) => {
        const copied = clone(node);
        copied.id = idMap.get(node.id);
        copied.name = node.id === root.id ? `${node.name} — копия` : node.name;
        copied.x = Number(node.x) + 48;
        copied.y = Number(node.y) + 48;
        copied.parent_id = idMap.get(node.parent_id) || node.parent_id || "";
        return copied;
      });

    const existingEdgeIds = new Set((this._config.edges || []).map((edge) => edge.id));
    const copiedEdges = (this._config.edges || [])
      .filter((edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target))
      .map((edge) => ({
        ...clone(edge),
        id: this._uniqueId(`${edge.id}_copy`, existingEdgeIds),
        source: idMap.get(edge.source),
        target: idMap.get(edge.target),
      }));

    this._config.nodes.push(...copies);
    this._config.edges.push(...copiedEdges);
    this._selectedNodeId = idMap.get(root.id);
    this._selectedEdgeId = null;
    this._afterStructureChange({ inspector: true });
    this._toast(copiedIds.size > 1 ? "Щит и его содержимое продублированы" : "Узел продублирован");
  }

  _deleteSelectedNode() {
    if (!this._isAdmin() || !this._editing) return;
    const node = this._selectedNode();
    if (!node) return;
    const ids = this._descendantIds(node.id);
    const label = ids.size > 1
      ? `Удалить «${node.name}» вместе с ${ids.size - 1} вложенными узлами и всеми соединениями?`
      : `Удалить узел «${node.name}» и все его соединения?`;
    if (!window.confirm(label)) return;
    this._config.nodes = (this._config.nodes || []).filter((item) => !ids.has(item.id));
    this._config.edges = (this._config.edges || []).filter(
      (edge) => !ids.has(edge.source) && !ids.has(edge.target)
    );
    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._afterStructureChange({ inspector: true });
    this._toast("Узел удалён");
  }

  _deleteSelectedEdge() {
    if (!this._isAdmin() || !this._editing) return;
    const edge = this._selectedEdge();
    if (!edge) return;
    if (!window.confirm("Удалить выбранное соединение?")) return;
    this._config.edges = (this._config.edges || []).filter((item) => item.id !== edge.id);
    this._selectedEdgeId = null;
    this._afterStructureChange({ inspector: true });
    this._toast("Соединение удалено");
  }

  _handleEditorControl(target) {
    if (!this._isAdmin() || !this._config) return false;
    let changed = false;
    let structural = false;
    let visual = false;
    const node = this._selectedNode();
    const edge = this._selectedEdge();

    if (node && target.dataset.nodeField) {
      const field = target.dataset.nodeField;
      const previous = node[field];
      const value = String(target.value ?? "");
      if (field === "type") {
        if (!NODE_TYPE_META[value]) return false;
        const hasChildren = (this._config.nodes || []).some((item) => item.parent_id === node.id);
        if (previous === "board" && value !== "board" && hasChildren) {
          target.value = previous;
          this._toast("Сначала перенесите или удалите элементы, расположенные внутри щита", true);
          return false;
        }
        node.type = value;
        const previousDefault = NODE_TYPE_META[previous]?.icon;
        if (!node.icon || node.icon === previousDefault) node.icon = NODE_TYPE_META[value].icon;
        if (value === "board" && node.parent_id) node.parent_id = "";
        structural = true;
      } else if (field === "parent_id") {
        if (value === node.id || (value && this._isDescendant(value, node.id))) {
          target.value = previous || "";
          this._toast("Нельзя поместить щит внутрь собственного дочернего узла", true);
          return false;
        }
        node.parent_id = value;
        structural = true;
      } else {
        node[field] = value;
        visual = true;
      }
      changed = previous !== node[field];
    } else if (node && target.dataset.nodeNumber) {
      const field = target.dataset.nodeNumber;
      const value = Number(target.value);
      if (Number.isFinite(value)) {
        const minimum = field === "h" ? 60 : 100;
        const normalized = clamp(value, minimum, 1500);
        changed = Number(node[field]) !== normalized;
        node[field] = normalized;
        visual = true;
      }
    } else if (node && target.dataset.nodeEntity) {
      const key = target.dataset.nodeEntity;
      node.entities ||= {};
      const value = String(target.value || "").trim();
      changed = node.entities[key] !== value;
      node.entities[key] = value;
      visual = true;
    } else if (edge && target.dataset.edgeField) {
      const field = target.dataset.edgeField;
      const previous = edge[field];
      const value = String(target.value || "");
      edge[field] = value;
      if (["source", "target"].includes(field)) {
        const duplicate = (this._config.edges || []).some(
          (item) => item.id !== edge.id && item.source === edge.source && item.target === edge.target
        );
        const invalid = edge.source === edge.target || duplicate || this._wouldCreateCycle(edge.source, edge.target, edge.id);
        if (invalid) {
          edge[field] = previous;
          target.value = previous;
          this._toast("Это изменение создаёт дубликат или замкнутый цикл", true);
          return false;
        }
        structural = true;
      } else {
        visual = true;
      }
      changed = previous !== edge[field];
    } else if (edge && target.dataset.edgeEntity) {
      const key = target.dataset.edgeEntity;
      edge.entities ||= { state: "", power: "" };
      const value = String(target.value || "").trim();
      changed = edge.entities[key] !== value;
      edge.entities[key] = value;
      visual = true;
    } else if (edge && target.dataset.edgeBool) {
      const field = target.dataset.edgeBool;
      const value = Boolean(target.checked);
      changed = edge[field] !== value;
      edge[field] = value;
      visual = true;
    } else if (target.dataset.configField) {
      const field = target.dataset.configField;
      const value = String(target.value || "");
      changed = this._config[field] !== value;
      this._config[field] = value;
      if (field === "title") this.shadowRoot.getElementById("page-title").textContent = value || "Электросхема дома";
    } else if (target.dataset.settingBool) {
      const field = target.dataset.settingBool;
      const value = Boolean(target.checked);
      changed = this._config.settings[field] !== value;
      this._config.settings[field] = value;
      visual = true;
    } else if (target.dataset.settingNumber) {
      const field = target.dataset.settingNumber;
      const value = Number(target.value);
      if (Number.isFinite(value)) {
        const limits = field === "grid_size" ? [5, 200] : [0, 1000000];
        const normalized = clamp(value, limits[0], limits[1]);
        changed = Number(this._config.settings[field]) !== normalized;
        this._config.settings[field] = normalized;
        visual = true;
      }
    } else if (target.dataset.summaryEntity) {
      const key = target.dataset.summaryEntity;
      const value = String(target.value || "").trim();
      this._config.settings.summary_entities ||= {};
      changed = this._config.settings.summary_entities[key] !== value;
      this._config.settings.summary_entities[key] = value;
      visual = true;
    }

    if (!changed) return false;
    if (structural) this._afterStructureChange({ inspector: false });
    else {
      this._clearLiveCaches();
      if (visual) {
        this._renderSurfaceSize();
        this._renderNodes();
        this._renderEdges();
        this._renderSummary();
        this._applyViewport();
      }
      this._markDirty();
    }
    return true;
  }

  _onInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    this._handleEditorControl(target);
  }

  _onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    this._handleEditorControl(target);
    if (target.dataset.nodeEntity || target.dataset.edgeEntity || target.dataset.summaryEntity) {
      const button = target.parentElement?.querySelector?.('[data-action="show-entity"]');
      if (button) {
        button.dataset.entity = target.value.trim();
        button.disabled = !target.value.trim();
      }
    }
  }

  _isDescendant(candidateId, rootId) {
    let current = this._nodeById.get(candidateId);
    const visited = new Set();
    while (current?.parent_id) {
      if (current.parent_id === rootId) return true;
      if (visited.has(current.parent_id)) break;
      visited.add(current.parent_id);
      current = this._nodeById.get(current.parent_id);
    }
    return false;
  }

  _afterStructureChange({ inspector = false } = {}) {
    this._rebuildGraphCache();
    this._clearLiveCaches();
    this._renderSurfaceSize();
    this._renderNodes();
    this._renderEdges();
    this._renderSummary();
    if (inspector) this._renderInspector();
    this._applyViewport();
    this._renderToolbar();
    this._markDirty();
  }

  _markDirty() {
    if (!this._isAdmin()) return;
    this._dirty = true;
    this._saveStatus = "dirty";
    this._changeVersion = (this._changeVersion || 0) + 1;
    this._updateSaveState();
    if (this._config?.settings?.auto_save && this._isAdmin()) {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._save(), 900);
    }
  }

  async _save(force = false) {
    if (!this._isAdmin() || !this._config || (!this._dirty && !force) || this._saveStatus === "saving") return;
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    const payload = clone(this._config);
    const payloadVersion = this._changeVersion || 0;
    this._saveStatus = "saving";
    this._updateSaveState();
    try {
      const result = await this._ws({
        type: "electrical_network/config/save",
        entry_id: this._entryId(),
        revision: force ? null : this._revision,
        config: payload,
      });
      this._revision = result.revision;
      if ((this._changeVersion || 0) === payloadVersion) {
        this._config = clone(result.config);
        this._dirty = false;
        this._saveStatus = "saved";
        this._renderAll();
      } else {
        this._saveStatus = "dirty";
        this._updateSaveState();
        if (this._config.settings?.auto_save) {
          this._saveTimer = setTimeout(() => this._save(), 450);
        }
      }
      this._toast(force ? "Серверная версия перезаписана" : "Схема сохранена");
    } catch (error) {
      this._saveStatus = "error";
      this._updateSaveState();
      if (this._isRevisionConflict(error)) this._showConflictModal();
      else {
        console.error("Electrical Network save failed", error);
        this._toast(`Не удалось сохранить: ${this._errorMessage(error)}`, true);
      }
    }
  }

  _isRevisionConflict(error) {
    const text = `${error?.code || ""} ${error?.message || error || ""}`.toLowerCase();
    return text.includes("revision_conflict") || text.includes("expected revision") || text.includes("current revision");
  }

  _showConflictModal() {
    this._openModal(
      "Схема изменена в другой вкладке",
      `<div class="warning-box">Серверная версия новее. Перезагрузка отбросит ваши несохранённые изменения. Принудительная запись заменит серверную схему текущей версией.</div>`,
      `<button class="btn" data-action="conflict-reload"><ha-icon icon="mdi:refresh"></ha-icon>Загрузить с сервера</button>
       <button class="btn danger" data-action="conflict-overwrite"><ha-icon icon="mdi:database-arrow-up-outline"></ha-icon>Перезаписать сервер</button>`
    );
  }

  async _reloadConfig(confirmDirty = true) {
    if (confirmDirty && this._dirty && !window.confirm("Отбросить несохранённые изменения и загрузить схему с сервера?")) return;
    const result = await this._ws({ type: "electrical_network/config/get", entry_id: this._entryId() });
    this._revision = result.revision;
    this._config = clone(result.config);
    this._dirty = false;
    this._saveStatus = "saved";
    this._changeVersion = (this._changeVersion || 0) + 1;
    this._selectedNodeId = this._config.nodes?.some((node) => node.id === this._selectedNodeId) ? this._selectedNodeId : null;
    this._selectedEdgeId = null;
    this._renderAll();
    const loading = this.shadowRoot.getElementById("loading");
    if (loading) loading.style.display = "none";
    this._toast("Схема загружена с сервера");
  }

  async _resetDemo() {
    if (!this._isAdmin()) return;
    if (!window.confirm("Заменить текущую схему демонстрационным примером? Это действие нельзя отменить.")) return;
    const result = await this._ws({
      type: "electrical_network/config/reset",
      entry_id: this._entryId(),
      revision: this._revision,
    });
    this._revision = result.revision;
    this._config = clone(result.config);
    this._dirty = false;
    this._saveStatus = "saved";
    this._changeVersion = (this._changeVersion || 0) + 1;
    this._selectedNodeId = this._config.nodes?.find((node) => node.id === "kitchen_breaker")?.id || null;
    this._selectedEdgeId = null;
    this._renderAll();
    this._toast("Демонстрационная схема восстановлена");
  }

  _openModal(title, body, footer = "") {
    const host = this.shadowRoot.getElementById("modal-host");
    host.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="icon-btn" data-action="close-modal"><ha-icon icon="mdi:close"></ha-icon></button></div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
        </div>
      </div>`;
    const backdrop = host.querySelector("[data-modal-backdrop]");
    backdrop?.addEventListener("click", (event) => {
      if (event.target === backdrop) this._closeModal();
    });
  }

  _closeModal() {
    this.shadowRoot.getElementById("modal-host").innerHTML = "";
    this._pendingImport = null;
  }

  _exportJson() {
    return JSON.stringify(this._config, null, 2);
  }

  _showExportModal() {
    const json = escapeHtml(this._exportJson());
    this._openModal(
      "Экспорт схемы",
      `<textarea id="export-json" readonly spellcheck="false">${json}</textarea>`,
      `<button class="btn" data-action="copy-export"><ha-icon icon="mdi:content-copy"></ha-icon>Копировать</button>
       <button class="btn primary" data-action="download-export"><ha-icon icon="mdi:download-outline"></ha-icon>Скачать JSON</button>`
    );
  }

  async _copyExport() {
    const text = this._exportJson();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_error) {
      const textarea = this.shadowRoot.getElementById("export-json");
      textarea?.select();
      document.execCommand?.("copy");
    }
    this._toast("JSON скопирован");
  }

  _downloadExport() {
    const blob = new Blob([this._exportJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `electrical-network-${date}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this._toast("Файл экспорта подготовлен");
  }

  async _onImportFile(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const normalized = this._normalizeImportedConfig(raw);
      this._clientValidateDiagram(normalized);
      this._pendingImport = normalized;
      this._openModal(
        "Импорт схемы",
        `<div class="warning-box">Будет загружена схема «${escapeHtml(normalized.title)}»: ${normalized.nodes.length} узлов и ${normalized.edges.length} соединений. Текущая схема останется на сервере до нажатия «Сохранить».</div>`,
        `<button class="btn" data-action="close-modal">Отмена</button><button class="btn primary" data-action="apply-import"><ha-icon icon="mdi:upload-outline"></ha-icon>Импортировать</button>`
      );
      this._pendingImport = normalized;
    } catch (error) {
      this._toast(`Импорт отклонён: ${this._errorMessage(error)}`, true);
    }
  }

  _normalizeImportedConfig(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("корневой JSON должен быть объектом");
    const settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
    const defaults = {
      demo_mode: true,
      auto_save: true,
      allow_control: false,
      flow_threshold_w: 3,
      grid_size: 20,
      show_grid: true,
      show_phase_balance: true,
      summary_entities: { power: "", energy: "", current: "", voltage: "", frequency: "" },
      summary_demo: { power: 0, energy: 0, current: 0, voltage: 230, frequency: 50 },
    };
    const rawSummaryEntities = settings.summary_entities && typeof settings.summary_entities === "object"
      ? settings.summary_entities
      : {};
    const rawSummaryDemo = settings.summary_demo && typeof settings.summary_demo === "object"
      ? settings.summary_demo
      : {};
    const numberOr = (value, fallback, minimum, maximum) => {
      const number = Number(value);
      return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback;
    };
    const normalizedSettings = {
      demo_mode: typeof settings.demo_mode === "boolean" ? settings.demo_mode : defaults.demo_mode,
      auto_save: typeof settings.auto_save === "boolean" ? settings.auto_save : defaults.auto_save,
      allow_control: typeof settings.allow_control === "boolean" ? settings.allow_control : defaults.allow_control,
      flow_threshold_w: numberOr(settings.flow_threshold_w, defaults.flow_threshold_w, 0, 1000000),
      grid_size: Math.round(numberOr(settings.grid_size, defaults.grid_size, 5, 200)),
      show_grid: typeof settings.show_grid === "boolean" ? settings.show_grid : defaults.show_grid,
      show_phase_balance: typeof settings.show_phase_balance === "boolean"
        ? settings.show_phase_balance
        : defaults.show_phase_balance,
      summary_entities: Object.fromEntries(
        Object.keys(defaults.summary_entities).map((key) => [key, String(rawSummaryEntities[key] || "").trim()])
      ),
      summary_demo: {
        power: numberOr(rawSummaryDemo.power, defaults.summary_demo.power, -1000000000, 1000000000),
        energy: numberOr(rawSummaryDemo.energy, defaults.summary_demo.energy, -1000000000, 1000000000),
        current: numberOr(rawSummaryDemo.current, defaults.summary_demo.current, -1000000, 1000000),
        voltage: numberOr(rawSummaryDemo.voltage, defaults.summary_demo.voltage, -1000000, 1000000),
        frequency: numberOr(rawSummaryDemo.frequency, defaults.summary_demo.frequency, 0, 1000000),
      },
    };
    const nodes = Array.isArray(raw.nodes) ? raw.nodes.map((source, index) => {
      const type = NODE_TYPE_META[source?.type] ? source.type : "load";
      const meta = NODE_TYPE_META[type];
      return {
        id: String(source?.id || `${type}_${index + 1}`),
        type,
        name: String(source?.name || source?.id || meta.label),
        description: String(source?.description || ""),
        icon: String(source?.icon || meta.icon),
        x: Number.isFinite(Number(source?.x)) ? Number(source.x) : 80 + index * 40,
        y: Number.isFinite(Number(source?.y)) ? Number(source.y) : 80 + index * 40,
        w: Number.isFinite(Number(source?.w)) ? Number(source.w) : meta.w,
        h: Number.isFinite(Number(source?.h)) ? Number(source.h) : meta.h,
        phase: String(source?.phase || "all"),
        nominal: String(source?.nominal || ""),
        parent_id: String(source?.parent_id || ""),
        entities: Object.fromEntries(ENTITY_KEYS.map((key) => [key, String(source?.entities?.[key] || "").trim()])),
        demo: source?.demo && typeof source.demo === "object" ? clone(source.demo) : {},
      };
    }) : [];
    const edges = Array.isArray(raw.edges) ? raw.edges.map((source, index) => ({
      id: String(source?.id || `edge_${index + 1}`),
      source: String(source?.source || ""),
      target: String(source?.target || ""),
      source_port: ["auto", "left", "right", "top", "bottom"].includes(source?.source_port) ? source.source_port : "auto",
      target_port: ["auto", "left", "right", "top", "bottom"].includes(source?.target_port) ? source.target_port : "auto",
      label: String(source?.label || ""),
      disabled: Boolean(source?.disabled),
      entities: {
        state: String(source?.entities?.state || "").trim(),
        power: String(source?.entities?.power || "").trim(),
      },
    })) : [];
    return {
      schema_version: 1,
      title: String(raw.title || "Электросхема дома"),
      settings: normalizedSettings,
      viewport: {
        x: Number.isFinite(Number(raw.viewport?.x)) ? Number(raw.viewport.x) : 0,
        y: Number.isFinite(Number(raw.viewport?.y)) ? Number(raw.viewport.y) : 0,
        zoom: clamp(Number.isFinite(Number(raw.viewport?.zoom)) ? Number(raw.viewport.zoom) : 1, 0.15, 3),
      },
      nodes,
      edges,
    };
  }

  _clientValidateDiagram(config) {
    if (!Array.isArray(config.nodes) || !config.nodes.length) throw new Error("схема должна содержать хотя бы один узел");
    if (config.nodes.length > 500) throw new Error("больше 500 узлов не поддерживается");
    if (!Array.isArray(config.edges) || config.edges.length > 1000) throw new Error("соединения отсутствуют или превышен лимит 1000");
    const nodeIds = new Set();
    const nodeById = new Map();
    for (const node of config.nodes) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(node.id)) throw new Error(`некорректный ID узла: ${node.id}`);
      if (nodeIds.has(node.id)) throw new Error(`повторяющийся ID узла: ${node.id}`);
      if (!NODE_TYPE_META[node.type]) throw new Error(`неподдерживаемый тип узла: ${node.type}`);
      if (!/^mdi:[a-z0-9-]+$/.test(node.icon)) throw new Error(`некорректная MDI-иконка узла ${node.id}`);
      nodeIds.add(node.id);
      nodeById.set(node.id, node);
      for (const entityId of Object.values(node.entities || {})) {
        if (entityId && !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) throw new Error(`некорректная сущность: ${entityId}`);
      }
    }
    for (const node of config.nodes) {
      if (!node.parent_id) continue;
      const parent = nodeById.get(node.parent_id);
      if (!parent || parent.type !== "board") throw new Error(`родитель узла ${node.id} должен быть щитом`);
      if (node.id === node.parent_id) throw new Error(`узел ${node.id} не может быть собственным родителем`);
      const visited = new Set([node.id]);
      let current = parent;
      while (current?.parent_id) {
        if (visited.has(current.parent_id)) throw new Error("обнаружен цикл вложенности щитов");
        visited.add(current.parent_id);
        current = nodeById.get(current.parent_id);
      }
    }
    const adjacency = new Map([...nodeIds].map((id) => [id, []]));
    const pairs = new Set();
    const edgeIds = new Set();
    for (const edge of config.edges) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(edge.id) || edgeIds.has(edge.id)) throw new Error(`некорректный или повторяющийся ID линии: ${edge.id}`);
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new Error(`линия ${edge.id} ссылается на неизвестный узел`);
      if (edge.source === edge.target) throw new Error(`линия ${edge.id} замкнута на тот же узел`);
      const pair = `${edge.source}\u0000${edge.target}`;
      if (pairs.has(pair)) throw new Error(`соединение ${edge.source} → ${edge.target} продублировано`);
      pairs.add(pair);
      edgeIds.add(edge.id);
      adjacency.get(edge.source).push(edge.target);
      for (const entityId of Object.values(edge.entities || {})) {
        if (entityId && !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(entityId)) throw new Error(`некорректная сущность: ${entityId}`);
      }
    }
    const visiting = new Set();
    const visited = new Set();
    const walk = (id) => {
      if (visiting.has(id)) throw new Error("электросеть содержит направленный цикл");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const target of adjacency.get(id) || []) walk(target);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of nodeIds) walk(id);
  }

  _applyPendingImport() {
    if (!this._pendingImport || !this._isAdmin()) return;
    const imported = clone(this._pendingImport);
    this._closeModal();
    this._config = imported;
    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._editing = true;
    this._connectMode = false;
    this._connectFrom = null;
    this._inspectorOpen = true;
    this._changeVersion = (this._changeVersion || 0) + 1;
    this._dirty = true;
    this._saveStatus = "dirty";
    this._renderAll();
    this._updateSaveState();
    if (this._config.settings?.auto_save) {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._save(), 1200);
    }
    this._toast("Схема импортирована. Проверьте её перед сохранением.");
  }

  _screenToDiagram(clientX, clientY) {
    const rect = this.shadowRoot.getElementById("canvas").getBoundingClientRect();
    const viewport = this._config.viewport || { x: 0, y: 0, zoom: 1 };
    return {
      x: (clientX - rect.left - Number(viewport.x || 0)) / Number(viewport.zoom || 1),
      y: (clientY - rect.top - Number(viewport.y || 0)) / Number(viewport.zoom || 1),
    };
  }

  _onNodePointerDown(event) {
    const element = event.target.closest?.("[data-node-id]");
    if (!element || event.button !== 0) return;
    event.stopPropagation();
    const nodeId = element.dataset.nodeId;
    if (this._connectMode) {
      this._selectNode(nodeId);
      return;
    }
    if (!this._editing || !this._isAdmin()) {
      this._selectNode(nodeId);
      return;
    }
    this._selectedNodeId = nodeId;
    this._selectedEdgeId = null;
    this._inspectorOpen = true;
    for (const candidate of this.shadowRoot.querySelectorAll("[data-node-id]")) {
      candidate.classList.toggle("selected", candidate.dataset.nodeId === nodeId);
    }
    this._renderEdges();
    this._renderInspector();

    const ids = this._nodeById.get(nodeId)?.type === "board" ? this._descendantIds(nodeId) : new Set([nodeId]);
    const start = this._screenToDiagram(event.clientX, event.clientY);
    const initial = new Map();
    for (const id of ids) {
      const node = this._nodeById.get(id);
      if (node) initial.set(id, { x: Number(node.x), y: Number(node.y) });
    }
    this._drag = { pointerId: event.pointerId, start, initial, moved: false };
    element.classList.add("dragging-node");
    element.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => this._onNodePointerMove(moveEvent);
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this._onNodePointerUp(upEvent);
    };
    this._drag.listeners = { move, up, element };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  _onNodePointerMove(event) {
    if (!this._drag || event.pointerId !== this._drag.pointerId) return;
    const point = this._screenToDiagram(event.clientX, event.clientY);
    const dx = point.x - this._drag.start.x;
    const dy = point.y - this._drag.start.y;
    if (Math.hypot(dx, dy) > 2) this._drag.moved = true;
    for (const [id, origin] of this._drag.initial) {
      const node = this._nodeById.get(id);
      if (!node) continue;
      node.x = round(origin.x + dx, 1);
      node.y = round(origin.y + dy, 1);
      const element = this.shadowRoot.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
      if (element) {
        element.style.left = `${node.x}px`;
        element.style.top = `${node.y}px`;
      }
    }
    this._renderEdges();
  }

  _onNodePointerUp(event) {
    if (!this._drag || event.pointerId !== this._drag.pointerId) return;
    const { moved, listeners } = this._drag;
    listeners?.element?.classList.remove("dragging-node");
    if (moved) {
      const grid = Number(this._config.settings?.grid_size || 20);
      if (!event.altKey && grid > 0) {
        for (const id of this._drag.initial.keys()) {
          const node = this._nodeById.get(id);
          if (!node) continue;
          node.x = round(Math.round(node.x / grid) * grid, 1);
          node.y = round(Math.round(node.y / grid) * grid, 1);
        }
      }
      this._didDrag = true;
      this._renderSurfaceSize();
      this._renderNodes();
      this._renderEdges();
      this._applyViewport();
      this._markDirty();
    }
    this._drag = null;
  }

  _onCanvasPointerDown(event) {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.target.closest?.("[data-node-id]") || event.target.closest?.("[data-edge-id]")) return;
    const canvas = this.shadowRoot.getElementById("canvas");
    const viewport = this._config.viewport || (this._config.viewport = { x: 0, y: 0, zoom: 1 });
    this._pan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: Number(viewport.x || 0),
      originY: Number(viewport.y || 0),
      moved: false,
    };
    canvas.classList.add("panning");
    canvas.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => this._onCanvasPointerMove(moveEvent);
    const up = (upEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      this._onCanvasPointerUp(upEvent);
    };
    this._pan.listeners = { move, up };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  _onCanvasPointerMove(event) {
    if (!this._pan || event.pointerId !== this._pan.pointerId) return;
    const dx = event.clientX - this._pan.startX;
    const dy = event.clientY - this._pan.startY;
    if (Math.hypot(dx, dy) > 2) this._pan.moved = true;
    this._config.viewport.x = round(this._pan.originX + dx, 1);
    this._config.viewport.y = round(this._pan.originY + dy, 1);
    this._applyViewport();
  }

  _onCanvasPointerUp(event) {
    if (!this._pan || event.pointerId !== this._pan.pointerId) return;
    this.shadowRoot.getElementById("canvas").classList.remove("panning");
    if (this._pan.moved) {
      this._didDrag = true;
      this._markDirty();
    } else if (!this._connectMode) {
      this._selectedNodeId = null;
      this._selectedEdgeId = null;
      this._renderNodes();
      this._renderEdges();
      this._renderInspector();
    }
    this._pan = null;
  }

  _onEdgeClick(event) {
    const target = event.target.closest?.("[data-edge-id]");
    if (!target || this._didDrag) return;
    event.stopPropagation();
    this._selectEdge(target.dataset.edgeId);
  }

  _onWheel(event) {
    if (!this._config) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    this._setZoomAt(Number(this._config.viewport.zoom || 1) * factor, event.clientX, event.clientY);
  }

  _setZoomAt(nextZoom, clientX, clientY) {
    const canvas = this.shadowRoot.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const viewport = this._config.viewport || (this._config.viewport = { x: 0, y: 0, zoom: 1 });
    const oldZoom = Number(viewport.zoom || 1);
    const zoom = clamp(nextZoom, 0.15, 3);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const diagramX = (localX - Number(viewport.x || 0)) / oldZoom;
    const diagramY = (localY - Number(viewport.y || 0)) / oldZoom;
    viewport.zoom = zoom;
    viewport.x = round(localX - diagramX * zoom, 2);
    viewport.y = round(localY - diagramY * zoom, 2);
    this._applyViewport();
    this._markDirty();
  }

  _zoomBy(factor) {
    const canvas = this.shadowRoot.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    this._setZoomAt(Number(this._config.viewport?.zoom || 1) * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  _fitToScreen() {
    const nodes = this._config.nodes || [];
    if (!nodes.length) return;
    const canvas = this.shadowRoot.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const minX = Math.min(...nodes.map((node) => Number(node.x)));
    const minY = Math.min(...nodes.map((node) => Number(node.y)));
    const maxX = Math.max(...nodes.map((node) => Number(node.x) + Number(node.w)));
    const maxY = Math.max(...nodes.map((node) => Number(node.y) + Number(node.h)));
    const padding = 70;
    const width = Math.max(100, maxX - minX);
    const height = Math.max(100, maxY - minY);
    const zoom = clamp(Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height), 0.15, 1.35);
    this._config.viewport = {
      zoom,
      x: round((rect.width - width * zoom) / 2 - minX * zoom, 2),
      y: round((rect.height - height * zoom) / 2 - minY * zoom, 2),
    };
    this._applyViewport();
    this._markDirty();
  }

  _autoLayout() {
    if (!this._isAdmin()) return;
    const nodes = this._config.nodes || [];
    if (!nodes.length) return;

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges = (this._config.edges || []).filter(
      (edge) => nodeById.has(edge.source) && nodeById.has(edge.target)
    );
    const boards = nodes.filter((node) => node.type === "board");
    const boardIds = new Set(boards.map((board) => board.id));
    const directChildren = new Map(boards.map((board) => [board.id, []]));
    for (const node of nodes) {
      if (directChildren.has(node.parent_id)) directChildren.get(node.parent_id).push(node);
    }
    for (const children of directChildren.values()) {
      children.sort((left, right) => Number(left.y) - Number(right.y) || Number(left.x) - Number(right.x));
    }

    const representativeCache = new Map();
    const representative = (nodeId) => {
      if (representativeCache.has(nodeId)) return representativeCache.get(nodeId);
      let current = nodeById.get(nodeId);
      const seen = new Set();
      while (current?.parent_id && nodeById.has(current.parent_id) && !seen.has(current.parent_id)) {
        seen.add(current.parent_id);
        current = nodeById.get(current.parent_id);
      }
      const result = current?.id || nodeId;
      representativeCache.set(nodeId, result);
      return result;
    };

    // Normalize board internals before placing the global topology. A board is
    // sized from its rows so downstream boards and loads can be aligned reliably.
    const boardHeader = 72;
    const boardBottom = 18;
    const rowGap = 14;
    for (const board of boards) {
      board.w = clamp(Number(board.w) || 410, 390, 560);
      const children = directChildren.get(board.id) || [];
      for (const child of children) {
        if (child.type === "board") continue;
        child.w = Math.max(220, Number(board.w) - 60);
        child.h = clamp(Number(child.h) || NODE_TYPE_META[child.type]?.h || 100, 82, 116);
      }
      const rowsHeight = children.reduce((sum, child) => sum + Number(child.h), 0);
      board.h = Math.max(180, boardHeader + rowsHeight + Math.max(0, children.length - 1) * rowGap + boardBottom);
    }

    // Collapse every node inside a board to that board and build only the
    // board-to-board feeder graph. Downstream panels are placed below their
    // upstream panel, which mirrors a real distribution hierarchy better than
    // a generic left-to-right graph layout.
    const downstreamBoards = new Map(boards.map((board) => [board.id, []]));
    const boardIndegree = new Map(boards.map((board) => [board.id, 0]));
    const boardPairs = new Set();
    for (const edge of edges) {
      const sourceRep = representative(edge.source);
      const targetRep = representative(edge.target);
      if (sourceRep === targetRep || !boardIds.has(sourceRep) || !boardIds.has(targetRep)) continue;
      const key = `${sourceRep}\u0000${targetRep}`;
      if (boardPairs.has(key)) continue;
      boardPairs.add(key);
      downstreamBoards.get(sourceRep).push(targetRep);
      boardIndegree.set(targetRep, (boardIndegree.get(targetRep) || 0) + 1);
    }
    for (const targets of downstreamBoards.values()) {
      targets.sort((left, right) => Number(nodeById.get(left)?.y || 0) - Number(nodeById.get(right)?.y || 0));
    }

    const placed = new Set();
    const boardX = 720;
    const boardStartY = 80;
    const boardVerticalGap = 92;

    const placeBoard = (boardId, y) => {
      const board = nodeById.get(boardId);
      if (!board || board.type !== "board") return y;
      if (placed.has(boardId)) return Number(board.y) + Number(board.h);
      placed.add(boardId);
      board.x = boardX;
      board.y = round(y, 1);

      let childY = Number(board.y) + boardHeader;
      for (const child of directChildren.get(board.id) || []) {
        child.x = Number(board.x) + 30;
        child.y = round(childY, 1);
        placed.add(child.id);
        childY += Number(child.h) + rowGap;
      }

      let subtreeBottom = Number(board.y) + Number(board.h);
      for (const childBoardId of downstreamBoards.get(board.id) || []) {
        const nextY = subtreeBottom + boardVerticalGap;
        subtreeBottom = Math.max(subtreeBottom, placeBoard(childBoardId, nextY));
      }
      return subtreeBottom;
    };

    const rootBoards = boards
      .filter((board) => (boardIndegree.get(board.id) || 0) === 0)
      .sort((left, right) => Number(left.y) - Number(right.y));
    let boardCursor = boardStartY;
    for (const board of rootBoards) {
      boardCursor = placeBoard(board.id, boardCursor) + 150;
    }
    for (const board of boards) {
      if (!placed.has(board.id)) boardCursor = placeBoard(board.id, boardCursor) + 150;
    }

    const outgoingByNode = new Map(nodes.map((node) => [node.id, []]));
    const incomingByNode = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of edges) {
      outgoingByNode.get(edge.source)?.push(edge);
      incomingByNode.get(edge.target)?.push(edge);
    }

    // Place external loads to the right of the breaker that feeds them. Longer
    // chains continue to the right while retaining the vertical alignment of
    // the original circuit row.
    const branchGap = 82;
    const branchVisited = new Set();
    const placeBranch = (nodeId, x, centerY, localVisited = new Set()) => {
      const node = nodeById.get(nodeId);
      if (!node || node.type === "board" || localVisited.has(nodeId)) return;
      localVisited.add(nodeId);
      if (!placed.has(nodeId)) {
        node.x = round(x, 1);
        node.y = round(centerY - Number(node.h) / 2, 1);
        placed.add(nodeId);
      }
      if (branchVisited.has(nodeId)) return;
      branchVisited.add(nodeId);

      const targets = (outgoingByNode.get(nodeId) || [])
        .map((edge) => representative(edge.target))
        .filter((targetId, index, values) => targetId !== representative(nodeId)
          && !boardIds.has(targetId)
          && values.indexOf(targetId) === index);
      targets.forEach((targetId, index) => {
        const target = nodeById.get(targetId);
        if (!target) return;
        const offset = (index - (targets.length - 1) / 2) * (Number(target.h) + 22);
        placeBranch(targetId, Number(node.x) + Number(node.w) + branchGap, centerY + offset, new Set(localVisited));
      });
    };

    for (const board of boards) {
      const exits = edges.filter((edge) => {
        const targetRep = representative(edge.target);
        return representative(edge.source) === board.id
          && targetRep !== board.id
          && !boardIds.has(targetRep);
      });
      const groups = new Map();
      for (const edge of exits) {
        const sourceId = edge.source;
        if (!groups.has(sourceId)) groups.set(sourceId, []);
        const targetRep = representative(edge.target);
        if (!groups.get(sourceId).includes(targetRep)) groups.get(sourceId).push(targetRep);
      }
      const sortedGroups = [...groups.entries()].sort((left, right) => {
        const leftNode = nodeById.get(left[0]);
        const rightNode = nodeById.get(right[0]);
        return Number(leftNode?.y || board.y) - Number(rightNode?.y || board.y);
      });
      sortedGroups.forEach(([sourceId, targetIds], groupIndex) => {
        const sourceNode = nodeById.get(sourceId);
        const fallbackCenter = Number(board.y) + boardHeader + 50 + groupIndex * 120;
        const centerY = sourceNode
          ? Number(sourceNode.y) + Number(sourceNode.h) / 2
          : fallbackCenter;
        targetIds.forEach((targetId, index) => {
          const target = nodeById.get(targetId);
          if (!target) return;
          const offset = (index - (targetIds.length - 1) / 2) * (Number(target.h) + 22);
          placeBranch(targetId, Number(board.x) + Number(board.w) + branchGap, centerY + offset);
        });
      });
    }

    // Lay out the incoming feeder chain of each root board from left to right.
    // This covers the usual Grid -> main breaker -> RCD -> distribution board
    // sequence without forcing every branch into a very wide rank graph.
    const trunkGap = 38;
    for (const rootBoard of rootBoards) {
      const nearestFirst = [];
      const seen = new Set([rootBoard.id]);
      let currentId = rootBoard.id;
      while (true) {
        const candidates = currentId === rootBoard.id
          ? edges.filter((edge) => representative(edge.target) === rootBoard.id && representative(edge.source) !== rootBoard.id)
          : (incomingByNode.get(currentId) || []);
        const edge = candidates.find((candidate) => {
          const source = nodeById.get(candidate.source);
          return source && !source.parent_id && source.type !== "board" && !seen.has(source.id);
        });
        if (!edge) break;
        const source = nodeById.get(edge.source);
        nearestFirst.push(source);
        seen.add(source.id);
        currentId = source.id;
        if (source.type === "source") break;
      }
      const chain = nearestFirst.reverse();
      if (!chain.length) continue;
      const totalWidth = chain.reduce((sum, node) => sum + Number(node.w), 0)
        + Math.max(0, chain.length - 1) * trunkGap;
      let x = Math.max(30, Number(rootBoard.x) - 70 - totalWidth);
      const centerY = Number(rootBoard.y) + Number(rootBoard.h) / 2;
      for (const node of chain) {
        node.x = round(x, 1);
        node.y = round(centerY - Number(node.h) / 2, 1);
        placed.add(node.id);
        x += Number(node.w) + trunkGap;
      }
    }

    // Keep disconnected or unusual top-level nodes usable instead of stacking
    // them at the origin. They are placed below the structured components.
    const remaining = nodes.filter((node) => !placed.has(node.id) && !node.parent_id);
    let fallbackX = 50;
    let fallbackY = Math.max(80, ...boards.map((board) => Number(board.y) + Number(board.h))) + 150;
    let rowHeight = 0;
    for (const node of remaining) {
      if (fallbackX + Number(node.w) > 1500) {
        fallbackX = 50;
        fallbackY += rowHeight + 70;
        rowHeight = 0;
      }
      node.x = fallbackX;
      node.y = fallbackY;
      placed.add(node.id);
      fallbackX += Number(node.w) + 70;
      rowHeight = Math.max(rowHeight, Number(node.h));
    }

    this._selectedNodeId = null;
    this._selectedEdgeId = null;
    this._afterStructureChange({ inspector: true });
    requestAnimationFrame(() => this._fitToScreen());
    this._toast("Схема автоматически выстроена");
  }

  _showEntity(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId },
    }));
  }

  async _controlEntityAction(entityId, turnOn) {
    if (!entityId || !this._config.settings?.allow_control) return;
    const [domain] = entityId.split(".");
    if (!["switch", "light", "input_boolean", "fan"].includes(domain)) {
      throw new Error("Эта сущность не поддерживает команды включения и отключения");
    }
    const action = turnOn ? "включить" : "отключить";
    if (!window.confirm(`Подтвердите: ${action} ${entityId}?`)) return;
    await this._hass.callService(domain, turnOn ? "turn_on" : "turn_off", { entity_id: entityId });
    this._toast(`Команда «${action}» отправлена`);
  }

  _scheduleLiveUpdate() {
    if (!this._loaded || !this._config || this._liveFrame) return;
    this._liveFrame = requestAnimationFrame(() => {
      this._liveFrame = null;
      if (!this._loaded || !this._config) return;
      this._clearLiveCaches();
      this._renderSummary();
      if (!this._drag) {
        this._renderNodes();
        this._renderEdges();
      }
      this._updateInspectorLive();
      this._renderEntityList();
    });
  }

  _updateInspectorLive() {
    const node = this._selectedNode();
    if (!node) return;
    for (const key of ["current", "power", "voltage", "energy", "frequency", "temperature"]) {
      const element = this.shadowRoot.querySelector(`[data-inspector-live="${key}"]`);
      if (element) element.textContent = this._formatMetric(this._metric(node, key), key);
    }
    const status = this._nodeStatus(node);
    const statusElement = this.shadowRoot.querySelector("[data-inspector-status]");
    if (statusElement) statusElement.textContent = this._statusLabel(status);
    const pill = this.shadowRoot.querySelector(".inspector-heading .status-pill");
    if (pill) {
      pill.classList.toggle("off", !status.energized);
      pill.innerHTML = `<span class="dot"></span>${escapeHtml(this._statusLabel(status))}`;
    }
  }

  _onKeydown(event) {
    if (!this.isConnected || !this._loaded) return;
    const active = this.shadowRoot.activeElement || document.activeElement;
    const editingText = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active?.isContentEditable;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "s") {
      event.preventDefault();
      this._save();
      return;
    }
    if (editingText) return;
    if (event.code === "Space") {
      this._spaceDown = true;
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      if (this.shadowRoot.getElementById("modal-host")?.innerHTML) this._closeModal();
      else if (this._connectMode) this._toggleConnectMode();
      else this._closeInspector();
      return;
    }
    if (modifier && event.key.toLowerCase() === "d" && this._selectedNodeId) {
      event.preventDefault();
      this._duplicateSelectedNode();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && this._editing) {
      event.preventDefault();
      if (this._selectedNodeId) this._deleteSelectedNode();
      else if (this._selectedEdgeId) this._deleteSelectedEdge();
    }
  }

  _onKeyup(event) {
    if (event.code === "Space") this._spaceDown = false;
  }

  _toast(message, isError = false) {
    const element = this.shadowRoot.getElementById("toast");
    if (!element) return;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    element.textContent = String(message || "");
    element.className = `toast show ${isError ? "error" : ""}`;
    this._toastTimer = setTimeout(() => {
      element.className = "toast";
    }, isError ? 5200 : 2600);
  }

  _errorMessage(error) {
    const message = error?.message || error?.body?.message || error?.error || String(error || "Неизвестная ошибка");
    return String(message).replace(/^Error:\s*/i, "");
  }
}

if (!customElements.get("electrical-network-panel")) {
  customElements.define("electrical-network-panel", ElectricalNetworkPanel);
}
