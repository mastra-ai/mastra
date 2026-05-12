### 1.2 Inbound: ingress to durable record

External work enters through the harness and is written as the owning durable row when a restart-sensitive boundary is required. The primary mappings stay explicit:

<figure>
<svg role="img" aria-labelledby="hx-inbound-title hx-inbound-desc" viewBox="0 0 900 420" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-inbound-title">Inbound: ingress to durable record</title>
  <desc id="hx-inbound-desc">Three primary ingress sources enter Harness and map to their owning durable rows: App and SDK to current run or queue, channel callbacks to inbox or action rows, and schedules to wakeup rows.</desc>
  <defs>
    <marker id="ah-inbound" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(15,50)">
    <rect width="200" height="340" rx="12" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
    <text x="10" y="-10" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="bold" fill="#6366f1" style="text-transform: uppercase; letter-spacing: 0.05em;">Ingress sources</text>
  </g>

  <g transform="translate(685,50)">
    <rect width="200" height="340" rx="12" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
    <text x="10" y="-10" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="bold" fill="#f97316" style="text-transform: uppercase; letter-spacing: 0.05em;">Harness logbook</text>
  </g>

  <g transform="translate(35,80)">
    <rect width="160" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">App / SDK</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">HTTP triggers</text>
  </g>
  <g transform="translate(35,180)">
    <rect width="160" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Channel provider</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">webhook / event</text>
  </g>
  <g transform="translate(35,280)">
    <rect width="160" height="60" rx="8" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Schedule</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">proactive fire</text>
  </g>

  <g transform="translate(370,180)">
    <rect width="160" height="80" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="80" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Harness</text>
    <text x="80" y="54" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">Front desk</text>
  </g>

  <g transform="translate(705,80)">
    <rect width="160" height="60" rx="8" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Current run / queue</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">accepted signal / queued item</text>
  </g>
  <g transform="translate(705,180)">
    <rect width="160" height="60" rx="8" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Inbox / action</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">callback row</text>
  </g>
  <g transform="translate(705,280)">
    <rect width="160" height="60" rx="8" fill="#fff7ed" stroke="#fdba74" stroke-width="1.5"/>
    <text x="80" y="26" text-anchor="middle" font-size="12" font-weight="600" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">Wakeup</text>
    <text x="80" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">scheduled row</text>
  </g>

  <path d="M 195 110 C 270 110, 320 200, 370 200" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>
  <text x="282" y="148" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">call</text>

  <path d="M 195 210 L 370 220" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>
  <text x="282" y="205" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">callback</text>

  <path d="M 195 310 C 270 310, 320 240, 370 240" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>
  <text x="282" y="278" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">fire</text>

  <path d="M 530 200 C 605 200, 655 110, 705 110" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>
  <path d="M 530 220 L 705 210" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>
  <path d="M 530 240 C 605 240, 655 310, 705 310" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-inbound)"/>

  <text x="617" y="205" text-anchor="middle" font-size="9" font-weight="600" fill="#475569" font-family="Inter, sans-serif">record</text>

  <text x="450" y="408" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">1.2 — Inbound: ingress to durable record</text>
</svg>
<figcaption>The three primary ingress source kinds and the durable rows they own; §3 owns admission, §5 owns persistence and crash-recovery, §14.1 owns channel binding mechanics.</figcaption>
</figure>
