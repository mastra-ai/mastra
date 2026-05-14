### 13.3 Wire protocol

Orientation diagram (cross-child reader map only; the per-child files below
remain authoritative for DTO shapes, ETag/If-Match rules, event envelope
identity, result lookups, and error projection):

<figure>
  <svg role="img" aria-labelledby="hx-wire-protocol-title hx-wire-protocol-desc" viewBox="0 0 1040 520" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-wire-protocol-title">Wire protocol orientation</title>
    <desc id="hx-wire-protocol-desc">Wire DTOs, conditional session-version mutations, SSE event envelope with replay, and the discriminated error envelope hang off §13.3 alongside the §13.2 HTTP route surface and §13.4 SDK composition.</desc>
    <defs>
      <marker id="ah-wire-protocol" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #f1f5f9; stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="40" y="28" width="960" height="58" />
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="50">§13.2 owns HTTP methods, paths, query/body placement, auth and tenant boundaries.</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="70">§13.4 owns SDK composition, rehydration, and client reactions to §4.5 classes and §13.3 wire codes.</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="280" y="110" width="480" height="64" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="520" y="140" text-anchor="middle">§13.3 wire DTOs and envelopes</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="520" y="162" text-anchor="middle">shared request bodies, envelope shapes, and the closed error union</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="210" width="220" height="146" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="234" text-anchor="middle">Request + result lookup</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="256" text-anchor="middle">02 · 05</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="280" text-anchor="middle">DTOs · admissionId</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="298" text-anchor="middle">idempotent retry</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="320" text-anchor="middle">operation result lookup</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="340" text-anchor="middle">routes (post-admission)</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="280" y="210" width="220" height="146" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="234" text-anchor="middle">Conditional mutation</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="256" text-anchor="middle">03</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="280" text-anchor="middle">GET → ETag = version</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="298" text-anchor="middle">PATCH state / thread-setting</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="316" text-anchor="middle">with If-Match: ETag</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="338" text-anchor="middle">mismatch → 409 state_conflict</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="520" y="210" width="220" height="146" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="234" text-anchor="middle">SSE event envelope</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="256" text-anchor="middle">04 · §10.5</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="280" text-anchor="middle">id = epoch-seq</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="298" text-anchor="middle">Last-Event-ID replay</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="316" text-anchor="middle">412 on gap / stale epoch</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="338" text-anchor="middle">→ refetch SessionSnapshot</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="760" y="210" width="240" height="146" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="234" text-anchor="middle">Error envelope</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="256" text-anchor="middle">06 · 07</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="280" text-anchor="middle">discriminated union on code</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="298" text-anchor="middle">→ §4.5 Harness*Error</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="316" text-anchor="middle">retryable hint · stable codes</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="338" text-anchor="middle">07 local-only errors stay local</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M420 174 L150 209" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M480 174 L390 209" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M560 174 L630 209" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M620 174 L880 209" />

    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="40" y="392">Typical client reconnect cycle (see §13.4f and §10.5 for normative steps)</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="40" y="404" width="220" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="430" text-anchor="middle">SSE drop</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="450" text-anchor="middle">network or eviction</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="280" y="404" width="220" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="430" text-anchor="middle">reconnect with Last-Event-ID</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="450" text-anchor="middle">same epoch → live tail</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="520" y="404" width="220" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="430" text-anchor="middle">412 Precondition Failed</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="450" text-anchor="middle">overflow or epoch change</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="760" y="404" width="240" height="60" />
    <text style="font: 600 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="880" y="430" text-anchor="middle">refetch snapshot + resubscribe</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="880" y="450" text-anchor="middle">GET /sessions/:id</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M260 434 L279 434" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M500 434 L519 434" />
    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-wire-protocol);" d="M740 434 L759 434" />
  </svg>
  <figcaption>The wire DTO and envelope contract groups request/result lookups, conditional mutations, the SSE event envelope, and the typed error union; the bottom band is the canonical client reconnect cycle shared by §13.3d and §13.4f.</figcaption>
</figure>

This section is the normative wire DTO and envelope contract for Harness v1,
but it remains an implementer-facing API rather than the ordinary application
API. Most consumers use the SDK (§13.4); raw HTTP clients, non-JS SDKs, server
route handlers, and version-skew debuggers use the shapes declared here
directly.

§13.2 owns HTTP methods, paths, query/body placement, route-specific emitted
status/code pairs, auth and tenant boundaries, and HTTP-only recovery
affordances. §13.3 owns the shared wire DTOs, cross-route request/response
envelopes, SSE envelope shape, and wire error details declared here. §13.2 may
still define narrow single-route bodies inline. The route DTO name map below
normalizes the local API, storage authority, wire body, and SDK projection names
for the major route families without redefining their owner sections. §13.4
owns SDK composition, rehydration, and client reactions to §4.5 classes and
§13.3 wire codes.
