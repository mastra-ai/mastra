export const dashboardCss = `
:root {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --bg: #09090b;
  --surface: #0c0c0e;
  --surface-raised: #18181b;
  --surface-soft: #111113;
  --border: #27272a;
  --border-strong: #3f3f46;
  --text: #fafafa;
  --muted: #a1a1aa;
  --accent: #fafafa;
  --accent-strong: #ffffff;
  --accent-ink: #09090b;
  --positive: #4ade80;
  --warning: #f4bf5f;
  --danger: #fb7c86;
  --info: #79b8ff;
  --radius: 10px;
  --shadow: 0 16px 40px rgb(0 0 0 / 28%);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.55; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: 1px; background: #27272a; }
main { width: min(1180px, calc(100% - 40px)); margin: auto; padding: 0 0 64px; }
a { color: #fafafa; text-underline-offset: 3px; }
button, select, textarea, input { font: inherit; }
button, .button { border: 0; }
code { color: #cbd8e8; font: .88em ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
h1, h2, h3, h4, p { margin-top: 0; }
h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.05; letter-spacing: -.045em; margin-bottom: .75rem; }
h2 { font-size: 1.35rem; line-height: 1.2; letter-spacing: -.02em; margin-bottom: 0; }
h3 { font-size: 1.05rem; line-height: 1.3; }
.muted { color: var(--muted); }
.app-header { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--border); margin-bottom: 34px; }
.brand { color: var(--text); display: inline-flex; align-items: center; gap: 12px; text-decoration: none; }
.brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #fafafa; color: #09090b; font-weight: 900; }
.brand strong, .brand small { display: block; }
.brand strong { font-size: .95rem; }
.brand small { color: var(--muted); font-size: .76rem; }
.auth-body { min-height: 100vh; overflow-x: hidden; background: #09090b; }
.auth-body::after { content: ""; position: fixed; z-index: -1; inset: 0; pointer-events: none; background: radial-gradient(circle at 18% 18%, rgb(255 255 255 / 4%), transparent 31%), linear-gradient(rgb(255 255 255 / 2%) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 2%) 1px, transparent 1px); background-size: auto, 64px 64px, 64px 64px; mask-image: linear-gradient(to bottom, black, transparent 78%); }
.auth-main { display: flex; flex-direction: column; width: min(1180px, calc(100% - 48px)); min-height: 100vh; padding: 0; }
.auth-header { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--border); }
.auth-environment { display: inline-flex; align-items: center; gap: 8px; color: #a1a1aa; font-size: .72rem; font-weight: 650; letter-spacing: .02em; }
.auth-environment > span { width: 7px; height: 7px; border-radius: 50%; background: #fafafa; box-shadow: 0 0 0 4px rgb(250 250 250 / 7%); }
.auth-layout { flex: 1; display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(360px, 440px); align-items: center; gap: clamp(64px, 9vw, 132px); padding: 72px 0; }
.auth-intro { max-width: 650px; }
.auth-intro h1 { max-width: 620px; font-size: clamp(3rem, 6vw, 5.25rem); letter-spacing: -.06em; margin-bottom: 24px; }
.auth-lead { max-width: 610px; color: #a1a1aa; font-size: clamp(1rem, 1.45vw, 1.15rem); line-height: 1.72; margin-bottom: 42px; }
.auth-capabilities { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--border); }
.auth-capabilities article { display: grid; gap: 17px; min-width: 0; padding: 20px 18px 0 0; }
.auth-capabilities article:not(:first-child) { border-left: 1px solid var(--border); padding-left: 18px; }
.auth-capabilities article > span { color: #52525b; font: .68rem ui-monospace, SFMono-Regular, Menlo, monospace; }
.auth-capabilities strong, .auth-capabilities small { display: block; }
.auth-capabilities strong { color: #e4e4e7; font-size: .8rem; margin-bottom: 6px; }
.auth-capabilities small { color: #71717a; font-size: .72rem; line-height: 1.55; }
.auth-card { position: relative; padding: 34px; border: 1px solid var(--border-strong); border-radius: 14px; background: rgb(12 12 14 / 92%); box-shadow: 0 28px 80px rgb(0 0 0 / 38%); backdrop-filter: blur(18px); }
.auth-card::before { content: ""; position: absolute; inset: 0 0 auto; height: 1px; background: linear-gradient(90deg, transparent, rgb(255 255 255 / 26%), transparent); }
.auth-card-icon { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 10px; background: #18181b; margin-bottom: 28px; }
.auth-card-icon > span { position: relative; width: 15px; height: 12px; border: 1.5px solid #e4e4e7; border-radius: 3px; margin-top: 5px; }
.auth-card-icon > span::before { content: ""; position: absolute; left: 2px; right: 2px; bottom: 9px; height: 9px; border: 1.5px solid #e4e4e7; border-bottom: 0; border-radius: 8px 8px 0 0; }
.auth-card h2 { font-size: 1.65rem; letter-spacing: -.035em; margin: 0 0 10px; }
.auth-card-copy { color: #a1a1aa; font-size: .9rem; line-height: 1.65; margin-bottom: 26px; }
.auth-card .button { gap: 10px; min-height: 46px; }
.auth-card .button-primary { justify-content: space-between; padding-inline: 17px; }
.auth-card .button-primary > span { font-size: 1.1rem; transition: transform .15s ease; }
.auth-card .button-primary:hover > span { transform: translateX(3px); }
.auth-divider { display: flex; align-items: center; gap: 12px; color: #52525b; font-size: .7rem; margin: 20px 0; }
.auth-divider::before, .auth-divider::after { content: ""; height: 1px; flex: 1; background: var(--border); }
.auth-security-note { color: #71717a; border-top: 1px solid var(--border); font-size: .72rem; line-height: 1.6; margin: 24px 0 0; padding-top: 20px; }
.auth-footer { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 24px; color: #52525b; border-top: 1px solid var(--border); font-size: .7rem; }
.auth-footer details { position: relative; }
.auth-footer summary { cursor: pointer; list-style: none; }
.auth-footer summary::-webkit-details-marker { display: none; }
.auth-footer details[open] code { display: block; position: absolute; right: 0; bottom: 25px; width: max-content; max-width: min(380px, 80vw); color: #a1a1aa; background: #111113; border: 1px solid var(--border); border-radius: 7px; padding: 7px 9px; }
.account-bar { display: flex; align-items: center; gap: 9px; }
.account-bar form { display: flex; align-items: center; margin: 0; }
.account-chip, .role-chip, .count-chip, .runbook-chip, .badge { display: inline-flex; align-items: center; border: 1px solid var(--border); border-radius: 999px; white-space: nowrap; }
.account-chip, .role-chip { padding: 5px 10px; color: var(--muted); font-size: .76rem; }
.role-chip { color: #d4d4d8; background: #18181b; border-color: #3f3f46; }
.button { display: inline-flex; justify-content: center; align-items: center; min-height: 42px; padding: 0 16px; border-radius: 9px; cursor: pointer; font-weight: 750; text-decoration: none; transition: transform .15s ease, background .15s ease, border-color .15s ease; }
.button:hover { transform: translateY(-1px); }
.button-primary { background: var(--accent); color: var(--accent-ink); border: 1px solid #fafafa; }
.button-primary:hover { background: #e4e4e7; }
.button-secondary { color: #fafafa; background: #18181b; border: 1px solid #3f3f46; }
.button-secondary:hover { background: #27272a; border-color: #52525b; }
.button-quiet { color: #d8e2ef; background: transparent; border: 1px solid var(--border); }
.button-quiet:hover { background: var(--surface-raised); border-color: var(--border-strong); }
.button-block { width: 100%; }
.breadcrumb { display: flex; align-items: center; gap: 9px; color: var(--muted); font-size: .86rem; margin-bottom: 24px; }
.breadcrumb a { color: #b6c5d7; text-decoration: none; }
.incident-hero { display: flex; justify-content: space-between; gap: 28px; align-items: flex-end; margin-bottom: 30px; }
.incident-hero h1 { margin-bottom: 12px; }
.eyebrow { color: #a1a1aa; font-size: .7rem; font-weight: 760; letter-spacing: .115em; line-height: 1.2; margin-bottom: 8px; text-transform: uppercase; }
.hero-meta { color: var(--muted); margin-bottom: 0; }
.hero-status { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; max-width: 430px; }
.status-badges { display: inline-flex; flex-wrap: wrap; gap: 8px; }
.badge { padding: 5px 10px; font-size: .75rem; font-weight: 760; }
.badge-neutral { color: #c9d5e4; background: var(--surface); }
.severity-critical, .severity-high, .status-failed, .status-rejected { color: #ffb1b8; background: rgb(251 124 134 / 10%); border-color: rgb(251 124 134 / 28%); }
.severity-medium, .status-pending, .status-awaiting_approval { color: #ffd58a; background: rgb(244 191 95 / 9%); border-color: rgb(244 191 95 / 25%); }
.severity-low, .status-completed, .status-approved { color: #86efac; background: rgb(74 222 128 / 8%); border-color: rgb(74 222 128 / 22%); }
.live-indicator { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); padding: 5px 3px 5px 8px; font-size: .75rem; }
.live-indicator > span { width: 7px; height: 7px; border-radius: 50%; background: #d4d4d8; box-shadow: 0 0 0 4px rgb(212 212 216 / 8%); }
.decision-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 18px; align-items: start; }
.content-stack { display: grid; gap: 18px; min-width: 0; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin: 18px 0 0; }
.content-stack > .card { margin-top: 0; }
.section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 18px; }
.section-heading .eyebrow { margin-bottom: 6px; }
.count-chip, .runbook-chip { padding: 4px 9px; font-size: .72rem; color: var(--muted); background: var(--surface-soft); }
.runbook-chip { color: #b8c8da; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.lead { color: #dce5f1; font-size: 1.03rem; line-height: 1.65; margin-bottom: 20px; }
.finding-list { display: grid; gap: 8px; }
.finding { display: grid; grid-template-columns: 22px 1fr; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 9px; background: rgb(255 255 255 / 2.5%); color: #d7e1ed; font-size: .9rem; }
.finding > span { font-weight: 900; }
.finding-confirmed > span { color: var(--positive); }
.finding-open > span { color: var(--warning); }
.hypotheses { margin-top: 12px; color: var(--muted); font-size: .9rem; }
.hypotheses > summary, .technical-details > summary, .event-details > summary { cursor: pointer; }
.hypotheses .finding { margin-top: 8px; }
.action-list { display: grid; gap: 12px; }
.action-card { display: grid; grid-template-columns: 32px 1fr; gap: 13px; padding: 16px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface-soft); }
.action-number { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 7px; color: #e4e4e7; background: #18181b; border: 1px solid #3f3f46; font-size: .78rem; font-weight: 850; }
.action-content h3 { margin: 2px 0 7px; }
.action-impact { color: #becbda; font-size: .9rem; margin-bottom: 8px; }
.target-line { color: var(--muted); font-size: .8rem; margin-bottom: 0; }
.technical-details { color: var(--muted); font-size: .82rem; margin-top: 12px; }
.technical-details dl, .event-details dl { display: grid; gap: 9px; margin: 12px 0 0; }
.technical-details dl > div, .event-details dl > div { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; }
.technical-details dt, .event-details dt { color: #7f91a7; }
.technical-details dd, .event-details dd { margin: 0; color: #bdcad9; overflow-wrap: anywhere; }
.plan-binding { border-top: 1px solid var(--border); padding-top: 14px; margin-top: 16px; }
.decision-panel { position: sticky; top: 18px; padding: 22px; border: 1px solid var(--border-strong); border-radius: var(--radius); background: #111113; box-shadow: var(--shadow); }
.decision-panel h2 { font-size: 1.25rem; margin-bottom: 12px; }
.decision-panel > p:not(.eyebrow):not(.decision-note):not(.plan-expiry) { color: #c5d4df; font-size: .9rem; }
.decision-panel .plan-expiry { color: var(--warning); font-size: .76rem; margin: 14px 0 10px; }
.decision-note { color: #a1a1aa; border-top: 1px solid var(--border); font-size: .76rem; margin: 17px 0 0; padding-top: 14px; }
.evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.evidence-card { display: grid; grid-template-columns: 30px 1fr; gap: 11px; min-width: 0; padding: 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-soft); }
.evidence-icon { width: 27px; height: 27px; display: grid; place-items: center; border-radius: 50%; font-weight: 900; color: var(--positive); background: rgb(74 222 128 / 8%); }
.evidence-card.is-missing .evidence-icon { color: var(--danger); background: rgb(251 124 134 / 9%); }
.evidence-card h3 { margin: 2px 0 3px; }
.evidence-card p, .evidence-card small { color: var(--muted); display: block; font-size: .76rem; margin-bottom: 0; overflow-wrap: anywhere; }
.status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.status-grid > div { padding: 12px; background: var(--surface-soft); border: 1px solid var(--border); border-radius: 9px; }
.status-grid span, .status-grid strong { display: block; }
.status-grid span { color: var(--muted); font-size: .72rem; margin-bottom: 4px; }
.status-grid strong { font-size: .93rem; }
.decision-reason { color: #bdcad9; padding: 12px; border-left: 3px solid var(--warning); margin: 15px 0 0; }
.review-card { border-color: rgb(244 191 95 / 24%); }
.review-reasons { display: grid; gap: 8px; margin: 18px 0 0; padding: 0; list-style: none; }
.review-reasons li { color: #d4d4d8; background: #0d0d0f; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
.runbook-card > summary { display: flex; align-items: center; justify-content: space-between; gap: 18px; cursor: pointer; list-style: none; }
.runbook-card > summary::-webkit-details-marker { display: none; }
.runbook-card > summary strong { display: block; font-size: 1rem; margin-top: 4px; }
.runbook-card[open] > summary .button { display: none; }
.runbook-header { display: flex; align-items: start; justify-content: space-between; gap: 28px; border-top: 1px solid var(--border); margin-top: 20px; padding-top: 22px; }
.runbook-header p { color: var(--muted); max-width: 680px; }
.runbook-header dl { display: grid; gap: 8px; min-width: 230px; margin: 0; }
.runbook-header dl div { display: flex; justify-content: space-between; gap: 14px; }
.runbook-header dt { color: var(--muted); }
.runbook-header dd { margin: 0; text-align: right; }
.runbook-sections { display: grid; gap: 8px; margin-top: 20px; }
.runbook-sections > details { border: 1px solid var(--border); border-radius: 10px; background: #0d0d0f; }
.runbook-sections > details.is-relevant { border-color: rgb(255 255 255 / 22%); background: #111113; }
.runbook-sections > details > summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; padding: 13px 15px; font-weight: 600; }
.runbook-sections pre { border-top: 1px solid var(--border); color: #c7c7cc; font: inherit; line-height: 1.65; margin: 0; padding: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
.execution-list { list-style: none; margin: 14px 0 0; padding: 0; }
.execution-list li { display: flex; justify-content: space-between; align-items: center; gap: 14px; border-top: 1px solid var(--border); padding: 10px 2px; font-size: .86rem; }
.activity-card { padding: 0; overflow: hidden; }
.activity-card > summary { display: flex; justify-content: space-between; align-items: center; gap: 18px; cursor: pointer; list-style: none; padding: 20px 24px; }
.activity-card > summary::-webkit-details-marker { display: none; }
.activity-card > summary strong { display: block; font-size: 1.1rem; }
.timeline { border-top: 1px solid var(--border); padding: 8px 24px 20px; }
.timeline > article { display: grid; grid-template-columns: 18px 1fr; gap: 10px; position: relative; padding: 12px 0; }
.timeline > article:not(:last-child)::after { content: ""; position: absolute; left: 4px; top: 28px; bottom: -10px; width: 1px; background: var(--border); }
.timeline-dot { width: 9px; height: 9px; border-radius: 50%; background: #7890a9; margin-top: 7px; z-index: 1; }
.timeline strong, .timeline time { display: block; }
.timeline strong { font-size: .88rem; }
.timeline time { color: var(--muted); font-size: .75rem; }
.event-details { color: var(--muted); font-size: .76rem; margin-top: 7px; }
dialog { width: min(540px, calc(100% - 30px)); color: var(--text); background: var(--surface); border: 1px solid var(--border-strong); border-radius: 16px; padding: 0; box-shadow: 0 30px 90px rgb(0 0 0 / 55%); }
dialog::backdrop { background: rgb(3 7 12 / 76%); backdrop-filter: blur(4px); }
.dialog-header { padding: 25px 26px 17px; border-bottom: 1px solid var(--border); }
.dialog-header h2 { font-size: 1.45rem; margin-bottom: 8px; }
.dialog-header > p:last-child { color: var(--muted); font-size: .88rem; margin-bottom: 0; }
.decision-form { display: grid; gap: 15px; padding: 22px 26px 26px; }
.field { display: grid; gap: 7px; color: #c9d5e2; font-size: .82rem; font-weight: 700; }
.field select, .field textarea { width: 100%; color: var(--text); background: var(--surface-soft); border: 1px solid var(--border-strong); border-radius: 9px; padding: 11px 12px; }
.field textarea { min-height: 92px; resize: vertical; }
.dialog-help { color: var(--muted); font-size: .78rem; margin-bottom: 0; }
.form-error { color: var(--danger); margin: 0; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 9px; padding-top: 4px; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin: 12px 0 30px; }
.page-header h1 { font-size: clamp(2rem, 4vw, 2.65rem); margin-bottom: 10px; }
.page-header > div > p:last-child { color: var(--muted); margin-bottom: 0; }
.statistics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
.statistic-card { min-width: 0; min-height: 142px; padding: 20px; background: var(--surface); }
.statistic-card:not(:last-child) { border-right: 1px solid var(--border); }
.statistic-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #d4d4d8; font-size: .8rem; font-weight: 650; }
.statistic-dot { width: 6px; height: 6px; border-radius: 50%; background: #52525b; }
.statistic-card[data-stat="awaiting-approval"] .statistic-dot { background: var(--warning); }
.statistic-card[data-stat="high-priority"] .statistic-dot { background: var(--danger); }
.statistic-card > strong { display: block; color: #fafafa; font-size: 2rem; line-height: 1; letter-spacing: -.04em; margin: 24px 0 8px; }
.statistic-card > small { color: #71717a; display: block; font-size: .72rem; }
.incidents-section { margin-top: 44px; }
.list-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
.list-heading h2 { font-size: 1.15rem; margin-bottom: 5px; }
.list-heading > div > p { color: var(--muted); font-size: .78rem; margin-bottom: 0; }
.filter-bar { display: flex; align-items: flex-end; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.filter-bar label { display: grid; gap: 5px; color: #71717a; font-size: .68rem; font-weight: 650; }
.filter-bar select { appearance: none; min-width: 132px; height: 36px; color: #e4e4e7; background: #111113; border: 1px solid var(--border); border-radius: 7px; padding: 0 30px 0 10px; background-image: linear-gradient(45deg, transparent 50%, #71717a 50%), linear-gradient(135deg, #71717a 50%, transparent 50%); background-position: calc(100% - 13px) 15px, calc(100% - 9px) 15px; background-size: 4px 4px, 4px 4px; background-repeat: no-repeat; font-size: .78rem; }
.filter-bar .button { min-height: 36px; height: 36px; padding-inline: 13px; font-size: .78rem; }
.clear-filter { align-self: center; color: var(--muted); font-size: .75rem; text-decoration: none; margin-left: 3px; }
.clear-filter:hover { color: #fafafa; }
.incident-table { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
.incident-table-header, .incident-row { display: grid; grid-template-columns: minmax(240px, 2.25fr) minmax(90px, .65fr) minmax(120px, .8fr) minmax(170px, 1fr) 20px; align-items: center; gap: 18px; }
.incident-table-header { min-height: 42px; color: #71717a; background: #111113; border-bottom: 1px solid var(--border); padding: 0 18px; font-size: .68rem; font-weight: 650; text-transform: uppercase; letter-spacing: .055em; }
.incident-row { min-height: 72px; color: #d4d4d8; padding: 12px 18px; text-decoration: none; transition: background .15s ease; }
.incident-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.incident-row:hover { background: #131315; }
.incident-identity { min-width: 0; }
.incident-identity strong, .incident-identity code { display: block; }
.incident-identity strong { color: #fafafa; font-size: .86rem; font-weight: 620; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.incident-identity code { color: #71717a; font-size: .69rem; margin-top: 3px; }
.incident-row .badge { justify-content: center; min-width: 76px; padding: 3px 8px; font-size: .67rem; }
.status-label { display: inline-flex; align-items: center; gap: 7px; color: #d4d4d8; font-size: .75rem; }
.status-label > span { width: 6px; height: 6px; border-radius: 50%; background: #71717a; }
.incident-row time { color: #a1a1aa; font-size: .72rem; }
.row-arrow { color: #52525b; transition: color .15s ease, transform .15s ease; }
.incident-row:hover .row-arrow { color: #fafafa; transform: translateX(2px); }
.empty-state { display: grid; justify-items: center; padding: 64px 20px; text-align: center; }
.empty-icon { width: 34px; height: 34px; display: grid; place-items: center; color: #71717a; border: 1px solid var(--border); border-radius: 50%; margin-bottom: 14px; }
.empty-state h3 { font-size: .95rem; margin-bottom: 6px; }
.empty-state p { color: var(--muted); font-size: .8rem; margin-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 14px; }
.pagination .button { min-height: 36px; gap: 8px; font-size: .78rem; }
:focus-visible { outline: 3px solid #8ed0ff; outline-offset: 3px; }
@media (max-width: 850px) {
  .auth-layout { grid-template-columns: 1fr; gap: 52px; padding: 56px 0; }
  .auth-intro { max-width: 720px; }
  .auth-intro h1 { max-width: 720px; }
  .auth-card { width: 100%; max-width: 520px; }
  .statistics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .statistic-card:nth-child(2) { border-right: 0; }
  .statistic-card:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
  .list-heading { align-items: flex-start; flex-direction: column; }
  .filter-bar { justify-content: flex-start; width: 100%; }
  .incident-table-header { display: none; }
  .incident-row { grid-template-columns: minmax(0, 1fr) auto; gap: 10px 16px; }
  .incident-row > span:nth-child(2), .incident-row > span:nth-child(3) { grid-row: 2; }
  .incident-row time { grid-column: 1; grid-row: 3; }
  .incident-row .row-arrow { grid-column: 2; grid-row: 1; }
  .decision-layout { grid-template-columns: 1fr; }
  .decision-panel { position: static; grid-row: 1; }
  .runbook-header { display: block; }
  .runbook-header dl { margin-top: 18px; }
  .evidence-grid { grid-template-columns: 1fr; }
  .status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  main { width: min(100% - 24px, 1180px); }
  .auth-main { width: min(100% - 32px, 1180px); }
  .auth-header { min-height: 78px; }
  .auth-environment { font-size: 0; gap: 0; }
  .auth-layout { gap: 40px; padding: 48px 0; }
  .auth-intro h1 { font-size: clamp(2.65rem, 14vw, 4rem); margin-bottom: 20px; }
  .auth-lead { margin-bottom: 32px; }
  .auth-capabilities { grid-template-columns: 1fr; }
  .auth-capabilities article { grid-template-columns: 24px 1fr; gap: 10px; padding: 15px 0; }
  .auth-capabilities article:not(:first-child) { border-left: 0; border-top: 1px solid var(--border); padding-left: 0; }
  .auth-card { padding: 26px 22px; }
  .auth-footer { align-items: flex-start; flex-direction: column; gap: 8px; padding: 18px 0; }
  .auth-footer details[open] code { right: auto; left: 0; }
  .app-header { align-items: flex-start; padding: 16px 0; }
  .account-chip, .role-chip { display: none; }
  .statistics-grid { grid-template-columns: 1fr 1fr; }
  .statistic-card { min-height: 124px; padding: 16px; }
  .statistic-card > strong { margin-top: 18px; }
  .filter-bar label { flex: 1 1 calc(50% - 8px); }
  .filter-bar label:last-of-type { flex-basis: 100%; }
  .filter-bar select { width: 100%; min-width: 0; }
  .incident-row { padding: 14px; }
  .incident-hero { align-items: flex-start; flex-direction: column; }
  .hero-status { justify-content: flex-start; }
  .card { padding: 18px; }
  .section-heading { align-items: flex-start; }
  .status-grid { grid-template-columns: 1fr 1fr; }
  .technical-details dl > div, .event-details dl > div { grid-template-columns: 1fr; gap: 2px; }
  .dialog-actions { flex-direction: column-reverse; }
  .dialog-actions .button { width: 100%; }
}
`;
