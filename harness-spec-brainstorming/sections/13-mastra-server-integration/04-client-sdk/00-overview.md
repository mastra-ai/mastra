### 13.4 Client SDK

`@mastra/client-js` exposes a `HarnessClient` with the same surface as the
in-process `Harness` — minus the parts that don't translate over the wire
(workspace direct access, in-process subscriptions to non-session events, etc.,
see §13.5).

```ts
import { MastraClient } from '@mastra/client-js';

const mastra = new MastraClient({ baseUrl: 'https://mastra.example.com' });
const harness = mastra.getHarness('coding');

// Same portable shape as in-process. `session` is a `RemoteSession` whose
// methods call the server routes and, when needed, compose them with SSE.
const session = await harness.session({ sessionId });

session.subscribe(event => render(event));
await session.queue({ content: 'Refactor auth' });
```

`MastraClient` is the existing `@mastra/client-js` entry point
(`../client-sdks/client-js/src/client.ts`) that already exposes resource
classes for `Agent` (`getAgent`), `Tool` (`getTool`), `Workflow`
(`getWorkflow`), `MemoryThread` (`getMemoryThread`), and other Mastra
surfaces. Harness v1 adds `getHarness(name)` to the same `MastraClient`,
returning a `HarnessClient` whose `session(...)` produces a `RemoteSession`.
Existing non-Harness agent/workflow/memory/MCP surfaces remain unchanged.
The `/harness/*` routes (§13.2) are additional auto-mounted routes on the
existing Mastra server Hono app, not a separate server. Existing agent,
workflow, MCP, and workspace routes continue to serve non-Harness consumers
alongside the new Harness routes.

Orientation diagram (SDK composition only; method details below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-sdk-flow-title hx-sdk-flow-desc" viewBox="0 0 1040 500" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-sdk-flow-title">Client SDK composition flow</title>
    <desc id="hx-sdk-flow-desc">RemoteSession methods call HTTP routes, capture admission metadata, follow SSE streams or result lookup routes to settle promises, and use ETag snapshots for state writes.</desc>
    <defs>
      <marker id="ah-sdk-flow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="45" y="70" width="210" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="101" text-anchor="middle">RemoteSession</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="124" text-anchor="middle">SDK method</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="320" y="70" width="190" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="415" y="101" text-anchor="middle">HTTP route</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="415" y="124" text-anchor="middle">wire boundary</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="575" y="70" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="101" text-anchor="middle">Admission metadata</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="685" y="124" text-anchor="middle">signalId / queuedItemId</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="850" y="25" width="160" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="930" y="53" text-anchor="middle">SSE stream</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="930" y="75" text-anchor="middle">live updates</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="850" y="125" width="160" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="930" y="153" text-anchor="middle">Result lookup</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="930" y="175" text-anchor="middle">settlement route</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="850" y="250" width="160" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="930" y="281" text-anchor="middle">Settle promise</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="930" y="304" text-anchor="middle">resolve / reject</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="320" y="270" width="190" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="415" y="301" text-anchor="middle">Snapshot</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="415" y="324" text-anchor="middle">session state / ETag</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="575" y="270" width="220" height="74" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="685" y="301" text-anchor="middle">State write</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="685" y="324" text-anchor="middle">If-Match metadata write</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="45" y="390" width="210" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="418" text-anchor="middle">Local schema</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="440" text-anchor="middle">client object</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="320" y="390" width="190" height="68" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="415" y="418" text-anchor="middle">WireSchemaRef</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="415" y="440" text-anchor="middle">route payload</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M255 107 L319 107" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M510 107 L574 107" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M795 96 L849 66" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M795 118 L849 150" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M930 93 L930 249" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M930 193 L930 249" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M415 144 L415 269" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M510 307 L574 307" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M255 424 L319 424" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-sdk-flow);" d="M415 390 L415 145" />
  </svg>
  <figcaption>The client SDK composes route calls, admission metadata, live or lookup settlement, snapshot ETags, and local schema references without making them separate runtime concepts.</figcaption>
</figure>
