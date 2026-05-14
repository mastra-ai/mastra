### 4.4 Operation option types

Read/list pagination is forward-only and cursor based across public Harness
reads unless a route explicitly says it is structurally bounded and unpaged.
`cursor` values are opaque server-issued navigation tokens, not principal read
state, not SSE `Last-Event-ID` replacements, and not durable notification
anchors. They bind to the route, harness/resource/session/thread scope, filters
such as `includeClosed` / `includeDescendants`, and the route's declared
ordering. Malformed, wrong-scope, wrong-filter, non-positive, fractional, or
over-maximum limits reject with `HarnessValidationError` in-process and `400
harness.validation` on wire routes before storage is scanned. When omitted,
server routes use the configured default/max limit from §9; in-process callers
use the same defaults unless they are explicitly operating below the route
layer. Cursors may expire when their backing rows or tombstones leave retention;
they do not promise a stable historical read position after source compaction.

The three operation primitives share a common shape. All extend
`HarnessOverrides`. In-process schema-bearing options use Mastra `PublicSchema`
objects (including Zod-compatible schemas and other Standard Schema shapes). Raw
remote HTTP never receives these live schema objects; §4.8 records the public
import ownership and §13.3 defines the JSON wire schema DTO.

Orientation diagram (option families only; interfaces below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-operation-options-title hx-operation-options-desc" viewBox="0 0 1060 500" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-operation-options-title">Operation option families</title>
    <desc id="hx-operation-options-desc">Message, queue, and skill options share serializable overrides, request context, tracing, file attachments, and admission ID hashing, with sync output and addTools restricted to specific paths.</desc>
    <defs>
      <marker id="ah-operation-options" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="415" y="25" width="230" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="54" text-anchor="middle">Operation options</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="76" text-anchor="middle">message / queue / skill</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="70" y="150" width="200" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="170" y="178" text-anchor="middle">MessageOptions</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="170" y="200" text-anchor="middle">signal or sync generate</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="320" y="150" width="200" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="420" y="178" text-anchor="middle">QueueOptions</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="420" y="200" text-anchor="middle">durable FIFO item</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="570" y="150" width="200" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="670" y="178" text-anchor="middle">UseSkillOptions</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="670" y="200" text-anchor="middle">resolved prompt path</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="820" y="150" width="180" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="910" y="178" text-anchor="middle">Pagination</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="910" y="200" text-anchor="middle">cursor / limit</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="145" y="310" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="250" y="339" text-anchor="middle">Serializable inputs</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="250" y="362" text-anchor="middle">files / app context / tracing</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="425" y="310" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="530" y="339" text-anchor="middle">Admission identity</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="530" y="362" text-anchor="middle">admissionId + stable hash</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="705" y="310" width="210" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="810" y="339" text-anchor="middle">Restricted fields</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="810" y="362" text-anchor="middle">output / sync / addTools</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M455 95 C350 120 220 125 175 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M500 95 C455 120 430 125 423 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M560 95 C610 120 655 125 667 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M625 95 C745 120 870 125 905 149" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M260 218 L250 309" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M420 218 C445 255 485 285 520 309" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-operation-options);" d="M670 218 C640 255 585 285 545 309" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-operation-options);" d="M170 218 C320 255 650 265 800 309" />
    <path style="stroke: #64748b; stroke-width: 2; fill: none; stroke-dasharray: 7 7; marker-end: url(#ah-operation-options);" d="M670 218 C720 255 770 285 805 309" />
  </svg>
  <figcaption>Operation options share serializable admission material, but retry-safe IDs and non-serializable overrides are deliberately constrained by operation kind.</figcaption>
</figure>
