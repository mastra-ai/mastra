### 13.3a Route DTO Name Map

**Route DTO name map.** Wire DTOs are serialized projections of the
`RemoteSafeSession` option and result surface (§4.8): live local objects are
replaced with wire equivalents such as `WireSchemaRef`, `WireAttachment`, ETag
headers, SSE envelopes, or multipart uploads. This table is an index, not a
second definition of route methods, storage records, state machines, or SDK
retry rules. Route details remain in §13.2, local method semantics in §4,
durable authorities and read models in §5, event replay in §10, SDK composition
in §13.4, and channel adapter-owned payloads in §14. Operator/internal routes,
diagnostic-only surfaces, storage-only ledgers, and local-only methods absent
from `RemoteSafeSession` (§13.5) are intentionally excluded unless a row names a
public projection.

**Session resolve/read**

Local/session API: `harness.session(...)`, session reads (§4.1, §4.2)

Durable authority or read source: Active `SessionRecord`; `SessionListItem` /
`SessionSnapshot` read models (§5.1)

Raw wire body / response: `POST /sessions` resolver body; `GET /sessions`
returns `WireListPage<SessionListItem>`; `GET /sessions/:sessionId` returns
`SessionSnapshot` plus `ETag` (§13.2)

SDK normalization: `HarnessClient.getHarness(...).session(...)` hydrates a
`RemoteSession`; SDK preserves snapshot and ETag inputs for later reads/writes
(§13.4)

**Session close**

Local/session API: `session.close()` / `harness.closeSession(...)` (§4.1, §4.2)

Durable authority or read source: `SessionRecord.closingAt`, `closeDeadlineAt`,
`closedAt` (§5.5)

Raw wire body / response: `DELETE /sessions/:sessionId` has no separate
close-status DTO (§13.2)

SDK normalization: Retry-safe `RemoteSession.close()` uses DELETE and snapshot
refresh, not a polling route (§13.4)

**Signal message admission**

Local/session API: `session.message(opts)` without `sync` or `stream` (§4.2)

Durable authority or read source: accepted signal evidence, `currentRun`,
retained result evidence, and `OperationAdmissionTombstone` (§5.1, §5.7)

Raw wire body / response: `POST /messages` takes `MessageRequest` and returns
`MessageAdmissionResponse`; `GET /message-results/:signalId` returns
`MessageResultResponse`

SDK normalization: `RemoteSession.message(...)` records admission metadata, then
settles the local-looking promise from SSE or result lookup (§13.4)

**Stream message admission**

Local/session API: `session.message({ stream: true })` (§4.2)

Durable authority or read source: same accepted signal/result evidence as signal
messages (§5.1, §5.7)

Raw wire body / response: `POST /messages?stream=true` takes `MessageRequest`,
returns `Mastra-Run-Id` / `Mastra-Signal-Id` headers and a live text-tail SSE
body; result lookup remains `MessageResultResponse` (§13.2)

SDK normalization: SDK exposes `AgentStream` and recovers terminal status
through result lookup; the live text stream is not replayable (§13.4)

**Sync typed message**

Local/session API: `session.message({ sync: true, output })` (§4.2)

Durable authority or read source: no retry-safe v1 admission receipt, operation
tombstone, signal/queue result lookup, or sync-generate result route; only
ordinary committed session/message/usage effects survive when their canonical
owners record them (§5.7, §15.1)

Raw wire body / response: `POST /messages?sync=true` takes `MessageRequest` with
`output: WireSchemaRef` and returns `200` with the projected typed JSON value
directly; if current `Agent.generate(..., { structuredOutput })` is used, the
response body is `FullOutput<T>.object`, not the `FullOutput` wrapper or an
`AgentResult` envelope

SDK normalization: SDK serializes local schemas to `WireSchemaRef`; automatic
retry is forbidden after send (§13.4)

**Queue**

Local/session API: `session.queue(opts)` (§4.2)

Durable authority or read source: `pendingQueue`, `QueueAdmissionReceipt`,
retained result evidence, and `OperationAdmissionTombstone` (§5.1, §5.7)

Raw wire body / response: `POST /queue` takes the message-shaped queue body and
returns `QueueAdmissionResponse`; `GET /queue/:queuedItemId/result` returns
`QueueResultResponse`

SDK normalization: SDK presents `queue(...)` as an `AgentResult` promise by
composing admission, events, and result lookup (§13.4)

**Skill invocation**

Local/session API: `session.useSkill(name, opts)` (§4.2, §4.6)

Durable authority or read source: deterministic skill expansion plus the
signal-message or sync typed authorities above; skill descriptors are resolved
from code/workspace sources (§4.6)

Raw wire body / response: `POST /skills/:skillName` takes
`SkillInvocationRequest`; untyped calls return `MessageAdmissionResponse`; typed
calls use `output: WireSchemaRef` and return the same projected typed JSON body
as sync messages

SDK normalization: SDK serializes local schemas, preserves untyped admission
metadata, and treats typed skill calls as non-retry-safe (§13.4)

**Skill discovery**

Local/session API: `session.listSkills()`, `session.getSkill(name)` (§4.2, §4.6)

Durable authority or read source: code-registered and workspace-discovered skill
resolution chain (§4.6)

Raw wire body / response: `GET /skills` / `GET /skills/:skillName` return
`WireHarnessSkillDescriptor` objects

SDK normalization: SDK deserializes descriptors; schema-bearing fields are JSON
Schema descriptors, not live schema objects (§13.4)

**Events**

Local/session API: `session.subscribe(listener)` (§4.2, §10)

Durable authority or read source: per-session event emission and replay buffer
rules (§10)

Raw wire body / response: `GET /events` uses the SSE envelope in this section
and `Last-Event-ID` replay (§13.2, §13.3)

SDK normalization: SDK owns reconnect, scoped subscription-token fallback, `412`
snapshot recovery, and unsubscribe behavior (§13.4)

**Inbox response**

Local/session API: `respondToToolApproval`, `respondToToolSuspension`,
`respondToQuestion`, `respondToPlanApproval` (§4.2)

Durable authority or read source: `pendingApproval`, `pendingSuspension`,
`pendingQuestion`, `pendingPlan`, and `InboxResponseReceipt` (§5.1, §5.7)

Raw wire body / response: `POST /inbox/:itemId` uses the kind-discriminated body
in §13.2 and returns `InboxResponseResult`; `GET /subagent-inbox` returns
`WireListPage<PendingInboxItem>`

SDK normalization: SDK projects `PendingInboxItem`, selects the owning session
route, and preserves `responseId` idempotency (§13.4)

**State and thread app metadata**

Local/session API: `getState()`, object-form `setState(...)`,
`setThreadSetting(...)` (§4.2)

Durable authority or read source: `SessionRecord.state`,
`SessionRecord.version`, `HarnessThread.metadata.app` (§5.1)

Raw wire body / response: `GET /state` / `PATCH /state` and
`PATCH /thread-settings/:key` use `ETag` / `If-Match`; thread settings use
`ThreadSettingRequest`

SDK normalization: SDK caches the session ETag and rejects stale writes rather
than replaying caller patches (§13.4)

**Mode, model, permissions, and OM config**

Local/session API: `switchMode`, `switchModel`, `permissions.*`, `om.*`
mutators/reads (§4.2)

Durable authority or read source: `SessionRecord.modeId`, `modelId`,
`permissionRules`, `sessionGrants`, `observationalMemory`; OM snapshots read
MemoryStorage through a verified projection (§5.1)

Raw wire body / response: `PATCH /mode`, `PATCH /model`, `PATCH /permissions`,
`GET/PATCH /om`; OM reads return `ObservationalMemorySnapshot | null` (§13.2)

SDK normalization: SDK exposes only `RemoteSafeSession` methods and applies the
capability / ETag / read-model rules from §13.2 and §13.4

**Goals**

Local/session API: `setGoal`, `getGoal`, `pauseGoal`, `resumeGoal`, `clearGoal`
(§4.7)

Durable authority or read source: `SessionRecord.goal` and goal continuation
queue receipts (§5.1)

Raw wire body / response: `PUT/GET/POST/DELETE /goal*` return `GoalState`,
`GoalState | null`, or no body as listed in §13.2

SDK normalization: SDK treats goal reads/mutations as direct remote-safe methods
and refetches after ambiguous events (§13.4)

**Threads and message log**

Local/session API: `listMessages(...)`, thread helpers on the Harness surface
(§4.1, §4.2)

Durable authority or read source: Harness-scoped `HarnessThread` plus shared
memory-domain message rows (§5.1, §5.2)

Raw wire body / response: `/threads/*` routes return `HarnessThread`,
`HarnessMessage`, `WireListPage<HarnessMessage>`, `ThreadSettingRequest`, or
`CloneThreadRequest` as applicable (§13.2, §13.3)

SDK normalization: SDK keeps `threadId` as history/navigation identity; clone
and thread app metadata stay Harness-layer operations (§13.4)

**Attachments**

Local/session API: `uploadAttachment(...)`, `deleteAttachment(...)`, and `files`
on operation options (§4.2, §4.4)

Durable authority or read source: `PersistedAttachment` metadata, bytes, and
reference graph (§5.1, §5.2)

Raw wire body / response: Operation bodies use `WireAttachment`; pre-upload is
multipart and returns `{ attachmentId: string }`; delete uses the attachment
route (§13.7)

SDK normalization: SDK maps `Uint8Array` / `onProgress` to multipart upload and
later `kind: 'ref'` JSON references (§13.4)

**Activity, channel diagnostics, and background task reads**

Local/session API: read-only SDK/controller projections, not operation
settlement (§4.8, §13.4)

Durable authority or read source: assembled from existing session, thread,
durable-work, channel, and task authorities (§5.1, §14.8 for channel
diagnostics)

Raw wire body / response: `GET /activity`, `/channel-diagnostics`, and scoped
`/background-tasks*` return redacted read models, not storage rows (§13.2)

SDK normalization: SDK/controller UIs may render these projections but must not
settle promises, claim rows, or infer missed SSE events from them (§13.4)


DTOs used by only one route family may remain inline in §13.2 when that is the
clearest owner; DTOs referenced across route families or SDK/non-JS boundaries
belong in §13.3's shared declarations.

Orientation diagram (wire flow only; DTO definitions below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-wire-flow-title hx-wire-flow-desc" viewBox="0 0 1120 540" width="100%" style="max-width: 1120px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-wire-flow-title">Wire protocol request flow</title>
    <desc id="hx-wire-flow-desc">A client sends wire DTOs through auth and validation into a harness route handler, which calls the session API and returns responses or SSE events that clients reconcile with snapshots or result lookup.</desc>
    <defs>
      <marker id="ah-wire-flow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="40" y="80" width="190" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="135" y="110" text-anchor="middle">SDK / HTTP client</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="135" y="132" text-anchor="middle">caller boundary</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="280" y="80" width="190" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="375" y="110" text-anchor="middle">Wire DTO</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="375" y="132" text-anchor="middle">JSON or multipart</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="520" y="80" width="190" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="615" y="110" text-anchor="middle">Route auth</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="615" y="132" text-anchor="middle">resource derivation</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="760" y="80" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="870" y="110" text-anchor="middle">Validation</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="132" text-anchor="middle">schema / attachments / ETag</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="760" y="235" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="870" y="265" text-anchor="middle">Harness route handler</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="287" text-anchor="middle">server integration layer</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="500" y="235" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="610" y="265" text-anchor="middle">Session API</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="610" y="287" text-anchor="middle">message / queue / state / inbox</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="255" y="235" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="365" y="265" text-anchor="middle">Wire response</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="365" y="287" text-anchor="middle">result / snapshot / error</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="500" y="390" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="610" y="420" text-anchor="middle">SSE event stream</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="610" y="442" text-anchor="middle">best-effort replay</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="255" y="390" width="220" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="365" y="420" text-anchor="middle">Reconcile</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="365" y="442" text-anchor="middle">snapshot / result lookup</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M230 116 L279 116" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M470 116 L519 116" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M710 116 L759 116" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M870 152 L870 234" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M760 271 L721 271" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M500 271 L476 271" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M255 271 C165 260 130 210 135 153" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M610 307 L610 389" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M500 426 L476 426" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-wire-flow);" d="M255 426 C120 395 95 250 118 153" />
  </svg>
  <figcaption>The wire protocol enters through server auth and validation, crosses the route handler into the Session API, then returns either bounded responses or live SSE events with explicit reconciliation paths.</figcaption>
</figure>
