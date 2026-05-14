### 4.8 Public type surface

This section is the canonical declaration/import map for public or
wire-adjacent Harness v1 names that are referenced across sections. Detailed
storage records, events, routes, and option objects still live with their owning
sections; this file prevents those names from becoming implicit imports from
current implementation packages.

Orientation diagram (ownership map only; declarations below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-public-types-title hx-public-types-desc" viewBox="0 0 1040 470" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-public-types-title">Public type surface ownership map</title>
    <desc id="hx-public-types-desc">Public types fan out into local helpers, wire DTO helpers, storage domain views, results and streams, and background task projections, each pointing to its owning spec section.</desc>
    <defs>
      <marker id="ah-public-types" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="395" y="25" width="250" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="56" text-anchor="middle">Public type surface</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="79" text-anchor="middle">exported declarations</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="25" y="155" width="180" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="115" y="184" text-anchor="middle">Local helpers</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="115" y="207" text-anchor="middle">session-only types</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="225" y="155" width="180" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="315" y="184" text-anchor="middle">Wire DTO helpers</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="315" y="207" text-anchor="middle">route-adjacent</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="425" y="155" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="184" text-anchor="middle">HarnessStorage</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="207" text-anchor="middle">storage domain</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="635" y="155" width="180" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="725" y="184" text-anchor="middle">Agent results</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="725" y="207" text-anchor="middle">result / stream</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="835" y="155" width="180" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="184" text-anchor="middle">BackgroundTask</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="207" text-anchor="middle">diagnostic view</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 12;" x="25" y="340" width="180" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="115" y="368" text-anchor="middle">§4 public API</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="115" y="390" text-anchor="middle">behavior owner</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 12;" x="225" y="340" width="180" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="315" y="368" text-anchor="middle">§13 wire</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="315" y="390" text-anchor="middle">route contracts</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 12;" x="425" y="340" width="190" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="368" text-anchor="middle">§5.2 storage</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="390" text-anchor="middle">method shape</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 12;" x="635" y="340" width="180" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="725" y="368" text-anchor="middle">§3 / §5.7</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="725" y="390" text-anchor="middle">settlement</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 12;" x="835" y="340" width="180" height="66" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="368" text-anchor="middle">§13 server</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="390" text-anchor="middle">diagnostics</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-public-types);" d="M434 97 C350 120 210 125 132 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-public-types);" d="M475 97 C430 120 365 125 325 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-public-types);" d="M520 97 L520 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-public-types);" d="M565 97 C610 120 675 125 715 154" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-public-types);" d="M606 97 C695 120 835 125 910 154" />

    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-public-types);" d="M115 227 L115 339" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-public-types);" d="M315 227 L315 339" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-public-types);" d="M520 227 L520 339" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-public-types);" d="M725 227 L725 339" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-public-types);" d="M925 227 L925 339" />
  </svg>
  <figcaption>Public types are a shared export surface, but ownership stays with the API, storage, wire, settlement, and server sections that define behavior.</figcaption>
</figure>
