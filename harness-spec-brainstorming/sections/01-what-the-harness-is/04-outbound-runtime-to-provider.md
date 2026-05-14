### 1.4 Outbound: runtime to provider

Provider-visible output is recorded as an Outbox row, then a Dispatch worker claims it, consults the channel registry, and sends it to the provider API:

<figure>
<svg role="img" aria-labelledby="hx-outbound-title hx-outbound-desc" viewBox="0 0 900 240" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-outbound-title">Outbound: runtime to provider</title>
  <desc id="hx-outbound-desc">Mastra runtime emits output that becomes an Outbox row, which a Dispatch worker claims, validates through the registry, and sends directly to the Provider API.</desc>
  <defs>
    <marker id="ah-outbound" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(15,80)">
    <rect width="150" height="90" rx="10" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="75" y="42" text-anchor="middle" font-size="12" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">Mastra runtime</text>
    <text x="75" y="60" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">produces output</text>
  </g>

  <g transform="translate(195,80)">
    <rect width="150" height="90" rx="10" fill="#fff7ed" stroke="#f97316" stroke-width="1.5"/>
    <text x="75" y="42" text-anchor="middle" font-size="12" font-weight="700" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Outbox</text>
    <text x="75" y="60" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">delivery row</text>
  </g>

  <g transform="translate(375,80)">
    <rect width="150" height="90" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="75" y="42" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Dispatch worker</text>
    <text x="75" y="60" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">claims &amp; sends</text>
  </g>

  <g transform="translate(555,25)">
    <rect width="150" height="70" rx="10" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="75" y="42" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Registry</text>
    <text x="75" y="58" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">lookup / validation</text>
  </g>

  <g transform="translate(735,80)">
    <rect width="150" height="90" rx="999" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="75" y="42" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">Provider API</text>
    <text x="75" y="60" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">external</text>
  </g>

  <path d="M 165 125 L 195 125" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-outbound)"/>
  <text x="180" y="115" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">output</text>

  <path d="M 345 125 L 375 125" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-outbound)"/>
  <text x="360" y="115" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">claim</text>

  <path d="M 525 125 L 735 125" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-outbound)"/>
  <text x="630" y="115" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">send</text>

  <path d="M 525 95 L 555 70" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#ah-outbound)"/>
  <text x="538" y="75" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">lookup</text>

  <text x="450" y="220" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">1.4 — Outbound: runtime to provider</text>
</svg>
<figcaption>Provider-visible output is recorded as an outbox row, claimed by a dispatch worker, validated through the registry, and sent to the provider; §14.4 owns outbox dispatch and §14.1 owns the channel binding contract.</figcaption>
</figure>
