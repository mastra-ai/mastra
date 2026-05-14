### 4.2 Session

`ReadonlyState<T>`, `AgentResult`, `AgentStream`, `TokenUsage`, and the
remote-safe session aliases used below are declared in §4.8.

Orientation diagram (method families only; signatures below remain
authoritative):

<figure>
<svg role="img" aria-labelledby="hx-session-api-title hx-session-api-desc" viewBox="0 0 900 360" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-session-api-title">Session API method families</title>
  <desc id="hx-session-api-desc">Session methods group into state, runtime defaults, operations, inbox responses, goals, files, and lifecycle. Operations emit operation-scoped events, and inbox responses resume operations.</desc>
  <defs>
    <marker id="ah-session-api" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(365,135)">
    <rect width="170" height="85" rx="10" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="85" y="38" text-anchor="middle" font-size="14" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Session</text>
    <text x="85" y="58" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">per-conversation API</text>
  </g>

  <g transform="translate(40,45)">
    <rect width="145" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="72.5" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">State</text>
    <text x="72.5" y="43" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">get / set / metadata</text>
  </g>
  <g transform="translate(40,145)">
    <rect width="145" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="72.5" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Defaults</text>
    <text x="72.5" y="43" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">mode / model</text>
  </g>
  <g transform="translate(40,245)">
    <rect width="145" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="72.5" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Files</text>
    <text x="72.5" y="43" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">messages / attachments</text>
  </g>

  <g transform="translate(710,35)">
    <rect width="150" height="60" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="75" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Operations</text>
    <text x="75" y="43" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">message / queue / skill</text>
  </g>
  <g transform="translate(710,115)">
    <rect width="150" height="60" rx="8" fill="#fff7ed" stroke="#f97316" stroke-width="1.5"/>
    <text x="75" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Inbox</text>
    <text x="75" y="43" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">approval / question</text>
  </g>
  <g transform="translate(710,195)">
    <rect width="150" height="60" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="75" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Goals</text>
    <text x="75" y="43" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">set / pause / resume</text>
  </g>
  <g transform="translate(710,275)">
    <rect width="150" height="60" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="75" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Lifecycle</text>
    <text x="75" y="43" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">close boundaries</text>
  </g>

  <path d="M 185 75 C 260 75, 295 150, 365 160" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 185 175 L 365 175" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 185 275 C 260 275, 295 205, 365 195" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 535 160 C 610 145, 650 65, 710 65" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 535 172 C 610 165, 650 145, 710 145" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 535 190 C 610 205, 650 225, 710 225" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 535 205 C 610 245, 650 305, 710 305" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-session-api)"/>
  <path d="M 710 132 C 650 110, 640 82, 710 72" fill="none" stroke="#f97316" stroke-width="1.3" stroke-dasharray="4 2" marker-end="url(#ah-session-api)"/>
  <text x="650" y="103" text-anchor="middle" font-size="9" font-weight="600" fill="#9a3412" font-family="Inter, sans-serif">resume</text>

  <text x="450" y="348" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">4.2 — Session API families</text>
</svg>
<figcaption>Method families on the Session API; the subsection signatures below remain authoritative for parameters, errors, and operation-scoped event behavior.</figcaption>
</figure>
