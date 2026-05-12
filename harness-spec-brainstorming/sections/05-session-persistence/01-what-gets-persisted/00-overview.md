### 5.1 What gets persisted

This section is the canonical owner for Harness durable record shapes,
JSON-safe serialization contracts, stable-hash byte profiles, and bounded read
projections derived directly from persisted rows. Storage helper methods live in
§5.2, lifecycle in §5.5, crash-recovery procedures in §5.7, lease behavior in
§5.8, public route and wire contracts in §13, channel bridge behavior in §14,
and verification acceptance checks in §15. When this section names those areas,
treat the wording as record context and a cross-reference rather than a second
source of truth.

Orientation diagram (record families only; field definitions below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-persisted-records-title hx-persisted-records-desc" viewBox="0 0 1060 560" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-persisted-records-title">Persisted record families</title>
    <desc id="hx-persisted-records-desc">Thread and channel records connect to session records, queue receipts, current runs, state, subagents, inbox, action receipts, outbox, and wakeup items.</desc>
    <defs>
      <marker id="ah-persisted-records" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="410" y="28" width="240" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="59" text-anchor="middle">SessionRecord</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="82" text-anchor="middle">durable session state</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="60" y="40" width="230" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="175" y="69" text-anchor="middle">HarnessThread</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="175" y="92" text-anchor="middle">message log scope</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="110" y="190" width="210" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="215" y="219" text-anchor="middle">pendingQueue</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="215" y="241" text-anchor="middle">QueueAdmissionReceipt</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="425" y="190" width="210" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="219" text-anchor="middle">currentRun</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="241" text-anchor="middle">pending items</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="740" y="190" width="230" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="855" y="219" text-anchor="middle">state / permissions</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="855" y="241" text-anchor="middle">workspace / attachments</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="425" y="330" width="210" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="359" text-anchor="middle">Subagents</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="381" text-anchor="middle">parent / child sessions</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="55" y="445" width="205" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="158" y="474" text-anchor="middle">ChannelBinding</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="158" y="496" text-anchor="middle">provider identity</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="320" y="445" width="195" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="418" y="474" text-anchor="middle">Inbox item</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="418" y="496" text-anchor="middle">ChannelInboxItem</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="565" y="445" width="205" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="668" y="474" text-anchor="middle">Action receipt</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="668" y="496" text-anchor="middle">token and response</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="820" y="445" width="195" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="918" y="474" text-anchor="middle">Outbox item</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="918" y="496" text-anchor="middle">provider delivery</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="90" y="320" width="250" height="70" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="215" y="349" text-anchor="middle">HarnessWakeupItem</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="215" y="371" text-anchor="middle">scheduled/proactive work</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M290 76 L409 66" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M470 102 C390 132 290 150 235 189" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M530 102 L530 189" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M592 102 C670 132 780 150 835 189" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M530 260 L530 329" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M215 390 L215 260" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M260 480 L319 480" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M515 480 L564 480" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M770 480 L819 480" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M668 445 C660 380 615 315 552 260" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-persisted-records);" d="M590 260 C690 335 820 390 900 444" />
  </svg>
  <figcaption>Persisted state centers on the session record, with channel, wakeup, queue, run, and outbox records preserving the recoverable work around it.</figcaption>
</figure>
