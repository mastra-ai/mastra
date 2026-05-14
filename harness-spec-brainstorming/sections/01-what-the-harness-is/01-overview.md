### 1.1 Overview

The lifecycle at a glance, harness at the center:

<figure>
<svg role="img" aria-labelledby="hx-overview-title hx-overview-desc" viewBox="0 0 900 340" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-overview-title">Harness architecture overview</title>
  <desc id="hx-overview-desc">Harness is the center: ingress enters Harness; Harness records durable rows and hydrates Session rooms; outbox dispatch sends provider-visible output.</desc>
  <defs>
    <marker id="ah-overview" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(25,130)">
    <rect width="150" height="80" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="75" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Ingress</text>
    <text x="75" y="56" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">App / SDK / Channels / Schedule</text>
  </g>

  <g transform="translate(330,130)">
    <rect width="150" height="80" rx="10" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="75" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Harness</text>
    <text x="75" y="56" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">Front desk</text>
  </g>

  <g transform="translate(330,25)">
    <rect width="150" height="80" rx="10" fill="#fff7ed" stroke="#f97316" stroke-width="1.5"/>
    <text x="75" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Logbook</text>
    <text x="75" y="56" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">Durable rows</text>
  </g>

  <g transform="translate(330,235)">
    <rect width="150" height="80" rx="10" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="75" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Session room</text>
    <text x="75" y="56" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">Conversation runtime</text>
  </g>

  <g transform="translate(555,25)">
    <rect width="140" height="80" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Dispatch worker</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">claims outbox</text>
  </g>

  <g transform="translate(735,25)">
    <rect width="140" height="80" rx="999" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Provider API</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">external</text>
  </g>

  <g transform="translate(555,235)">
    <rect width="140" height="80" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Recovery workers</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">claim &amp; re-enter</text>
  </g>

  <path d="M 175 170 L 330 170" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-overview)"/>
  <text x="252" y="160" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">enter</text>

  <path d="M 405 130 L 405 105" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-overview)"/>
  <text x="430" y="120" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">record</text>

  <path d="M 405 210 L 405 235" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-overview)"/>
  <text x="430" y="228" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">hydrate</text>

  <path d="M 480 65 L 555 65" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-overview)"/>
  <text x="517" y="55" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">outbox</text>

  <path d="M 695 65 L 735 65" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-overview)"/>
  <text x="715" y="55" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">send</text>

  <path d="M 480 90 C 560 135, 625 180, 625 235" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-overview)"/>
  <text x="570" y="135" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">claim</text>

  <path d="M 625 235 C 625 185, 525 170, 480 170" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-overview)"/>
  <text x="580" y="185" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">re-enter</text>

  <text x="450" y="330" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">1.1 — Architecture overview</text>
</svg>
<figcaption>Lifecycle at a glance with the harness at the center; §§1.2–1.5 own the per-arrow ingress, hydration, dispatch, and recovery contracts.</figcaption>
</figure>
