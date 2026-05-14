## 9. Configuration

Orientation diagram (configuration buckets only; the TypeScript surface below
remains authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-config-title hx-config-desc" viewBox="0 0 1080 600" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-config-title">Harness configuration buckets</title>
    <desc id="hx-config-desc">HarnessConfig fans out into runtime, storage, session policy, channels, wakeups, attachments, workspace providers, and live-helper event settings.</desc>
    <defs>
      <marker id="ah-config" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="415" y="25" width="250" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="540" y="55" text-anchor="middle">HarnessConfig</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="540" y="78" text-anchor="middle">configuration root</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="60" y="155" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="185" text-anchor="middle">Runtime surface</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="208" text-anchor="middle">agents / modes / tools</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="310" y="155" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="420" y="185" text-anchor="middle">HarnessStorage</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="420" y="208" text-anchor="middle">namespace ledgers</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="560" y="155" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="670" y="185" text-anchor="middle">Session policy</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="670" y="208" text-anchor="middle">leases / queue / receipts</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="810" y="155" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="185" text-anchor="middle">Channel bridges</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="208" text-anchor="middle">inbox / actions / outbox</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="60" y="330" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="360" text-anchor="middle">Wakeup workers</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="383" text-anchor="middle">scheduled/proactive work</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="310" y="330" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="420" y="360" text-anchor="middle">Attachment policy</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="420" y="383" text-anchor="middle">inline / URL / refs</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="560" y="330" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="670" y="360" text-anchor="middle">Workspace provider</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="670" y="383" text-anchor="middle">shared or per-session</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="810" y="330" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="920" y="360" text-anchor="middle">Events &amp; buffers</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="920" y="383" text-anchor="middle">intervals / SSE helpers</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="45" y="485" width="250" height="64" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="512" text-anchor="middle">Compatibility generation</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="533" text-anchor="middle">runtime compatibility</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M450 97 C345 120 230 125 180 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M505 97 C470 120 438 126 425 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M575 97 C610 120 648 126 665 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M630 97 C735 120 860 125 910 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M445 97 C300 185 200 260 175 329" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M505 97 C450 185 420 260 420 329" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M575 97 C630 185 670 260 670 329" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M630 97 C780 185 900 260 920 329" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M170 229 L170 484" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M820 229 C690 260 540 230 452 229" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-config);" d="M280 367 C330 320 370 270 402 230" />
  </svg>
  <figcaption>Configuration groups runtime choices, durable storage policy, session behavior, channel and wakeup bridges, attachment handling, workspace providers, and live event helpers.</figcaption>
</figure>
