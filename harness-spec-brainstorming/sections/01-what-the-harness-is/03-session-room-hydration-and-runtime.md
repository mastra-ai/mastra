### 1.3 Session room: hydration and runtime

The harness hydrates a Session, which assembles the request context and workspace state and admits the Mastra runtime engine:

<figure>
<svg role="img" aria-labelledby="hx-session-title hx-session-desc" viewBox="0 0 900 360" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-session-title">Session room: hydration and runtime</title>
  <desc id="hx-session-desc">The Harness hydrates a Session, which builds the request context and workspace state and admits the Mastra runtime engine.</desc>
  <defs>
    <marker id="ah-session" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(240,40)">
    <rect width="620" height="280" rx="12" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
    <text x="10" y="-10" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="bold" fill="#10b981" style="text-transform: uppercase; letter-spacing: 0.05em;">Session room</text>
  </g>

  <g transform="translate(40,140)">
    <rect width="140" height="80" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="70" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Harness</text>
    <text x="70" y="54" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">Front desk</text>
  </g>

  <g transform="translate(280,80)">
    <rect width="180" height="60" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="90" y="26" text-anchor="middle" font-size="12" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Session</text>
    <text x="90" y="44" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">thread / mode / lease</text>
  </g>

  <g transform="translate(280,180)">
    <rect width="180" height="60" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="90" y="22" text-anchor="middle" font-size="12" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Request context</text>
    <text x="90" y="38" text-anchor="middle" font-size="12" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">+ Workspace</text>
    <text x="90" y="52" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">memory / request / state</text>
  </g>

  <g transform="translate(520,80)">
    <rect width="320" height="140" rx="10" fill="#ecfdf5" stroke="#10b981" stroke-width="1.5"/>
    <text x="160" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Mastra runtime</text>
    <line x1="20" y1="42" x2="300" y2="42" stroke="#86efac" stroke-width="1"/>
    <text x="160" y="68" text-anchor="middle" font-size="11" font-weight="600" fill="#047857" font-family="Inter, sans-serif">Agent / Workflow engine</text>
    <text x="160" y="92" text-anchor="middle" font-size="11" font-weight="600" fill="#047857" font-family="Inter, sans-serif">Models / Tools / MCP</text>
    <text x="160" y="116" text-anchor="middle" font-size="11" font-weight="600" fill="#047857" font-family="Inter, sans-serif">Subagent execution</text>
  </g>

  <path d="M 180 170 C 230 170, 250 110, 280 110" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session)"/>
  <text x="225" y="135" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">hydrate</text>

  <path d="M 370 140 L 370 180" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session)"/>

  <path d="M 460 110 L 520 130" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session)"/>
  <text x="490" y="105" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">admit</text>

  <path d="M 460 210 L 520 200" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session)"/>
  <text x="490" y="192" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">feed</text>

  <text x="450" y="348" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">1.3 — Session room: hydration and runtime</text>
</svg>
<figcaption>The harness hydrates a session, which assembles the request context and workspace state and admits the Mastra runtime; §4 owns the Session API and §§5–6 own persistence and request context.</figcaption>
</figure>
