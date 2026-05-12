### 5.7 Failure and crash recovery

Persistence is what makes sessions resumable across server restarts and storage hiccups. This section spells out what survives, what doesn't, and what callers can rely on.

Section ownership: this section is the canonical cross-source owner for Harness
crash recovery, rehydration failure handling, run correlation after restart, and
the durability boundary between Harness-owned pre-acceptance state and
agent-owned post-acceptance state. Source-specific channel row shapes,
claim/renew transitions, retry budgets, duplicate callback status, and dispatch
mechanics remain owned by §14; worker readiness and externally reachable
durable-ingress refusal are owned by §13.6; §15 verifies these promises rather
than redefining them.

Orientation diagram (boundary map only; the tables below remain authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-recovery-boundaries-title hx-recovery-boundaries-desc" viewBox="0 0 1120 640" width="100%" style="max-width: 1120px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-recovery-boundaries-title">Recovery boundary map</title>
    <desc id="hx-recovery-boundaries-desc">Direct messages, queued work, channel inbox items, actions, wakeups, and outbound dispatch each cross different durable recovery boundaries.</desc>
    <defs>
      <marker id="ah-recovery-boundaries" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="35" y="40" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="68" text-anchor="middle">Direct message</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="90" text-anchor="middle">caller signal</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="275" y="38" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="380" y="67" text-anchor="middle">Signal accepted?</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="380" y="90" text-anchor="middle">first durable boundary</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="545" y="25" width="190" height="62" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="640" y="52" text-anchor="middle">Not accepted</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="640" y="73" text-anchor="middle">caller may resend</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="545" y="105" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="134" text-anchor="middle">Agent result boundary</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="157" text-anchor="middle">thread/result persisted</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="35" y="180" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="208" text-anchor="middle">Queue API</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="230" text-anchor="middle">background work</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="275" y="178" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="380" y="207" text-anchor="middle">Queued item</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="380" y="230" text-anchor="middle">receipt persisted</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="35" y="315" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="343" text-anchor="middle">Channel webhook</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="365" text-anchor="middle">provider callback</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="275" y="313" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="380" y="342" text-anchor="middle">ChannelInboxItem</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="380" y="365" text-anchor="middle">inbound ledger row</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="545" y="313" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="342" text-anchor="middle">Session admission</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="365" text-anchor="middle">message or queue</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="35" y="450" width="180" height="66" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="478" text-anchor="middle">Channel action</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="500" text-anchor="middle">provider interaction</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="275" y="448" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="380" y="477" text-anchor="middle">Action receipt</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="380" y="500" text-anchor="middle">token/receipt row</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="545" y="448" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="655" y="477" text-anchor="middle">Inbox response</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="655" y="500" text-anchor="middle">owning-session response</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="815" y="85" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="114" text-anchor="middle">Durable session state</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="137" text-anchor="middle">thread/session records</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="815" y="205" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="234" text-anchor="middle">Outbox projection</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="257" text-anchor="middle">delivery intent</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="815" y="325" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="354" text-anchor="middle">ChannelOutboxItem</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="377" text-anchor="middle">dispatch ledger</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="815" y="445" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="474" text-anchor="middle">Dispatch worker</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="497" text-anchor="middle">claimed outbound work</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="815" y="550" width="220" height="58" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="575" text-anchor="middle">Provider API</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="596" text-anchor="middle">external delivery</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="35" y="555" width="180" height="58" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="580" text-anchor="middle">Wakeup item</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="601" text-anchor="middle">scheduled work</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M215 73 L274 73" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M485 62 L544 56" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M485 84 C510 92 525 105 544 125" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M215 213 L274 213" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M380 178 L380 109" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M215 348 L274 348" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M485 348 L544 348" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M215 483 L274 483" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M485 483 L544 483" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M655 448 L655 384" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M215 584 C235 510 285 355 332 249" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M925 155 L925 204" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M925 275 L925 324" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M925 395 L925 444" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-recovery-boundaries);" d="M925 515 L925 549" />
  </svg>
  <figcaption>Inbound recovery re-enters session admission through accepted durable records; outbound recovery remains the dispatch path from outbox to provider.</figcaption>
</figure>
