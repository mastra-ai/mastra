### 13.2 Auto-mounted routes

When the proposed Harness v1 server surface is registered on a `Mastra` instance
served by Mastra Server, the following client/session and channel webhook routes
are auto-mounted under `/harness/:harnessName`. These `/harness/*` routes are v1
additions, not current built-in server routes. Single-harness sugar uses the
literal name `default`, so its wire routes are mounted under `/harness/default`.

Harness routes must extend the existing `@mastra/server` route registry at
`../packages/server/src/server/server-adapter/routes/index.ts` (the
`SERVER_ROUTES` registry exported at line 162, with generated route types)
and the route-registration entry at
`../packages/server/src/server/server-adapter/index.ts`. Harness route DTOs
are new route DTOs, but their implementation participates in the current
server route generation, OpenAPI emission, and auth/error pipelines. The
Harness wire surface does not introduce a separate transport stack or
bypass the server's existing route table.

Existing Mastra Server `/workspaces` routes are not the Harness remote session
contract. Harness v1 may reuse their core handlers and registry lookups as
implementation material only behind a session/resource-scoped projection or an
operator/Studio-scoped surface. Public `RemoteSession` clients still do not
receive raw `Workspace` handles, global workspace IDs, provider resume state, or
cross-resource workspace listings (§2.7, §13.5).

Existing Mastra Server `/mcp/*` routes are Mastra/MCP runtime routes, not
Harness session routes. They may list servers, tools, resources, or expose MCP
transport endpoints under their own auth and operator/Studio policy, but they do
not create `SessionRecord` rows, prove `currentRun` recovery, or provide
duplicate-safe callback/effect receipts for Harness. A Harness control plane
that summarizes MCP status must label it as runtime dependency diagnostics
unless a future source-specific MCP/app ledger is specified.

Orientation diagram (route families only; the route table below remains
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-route-families-title hx-route-families-desc" viewBox="0 0 1080 520" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-route-families-title">Auto-mounted Harness route families</title>
    <desc id="hx-route-families-desc">Authenticated client routes mount under a Harness name and split into session, thread, background task, attachment, channel callback, and optional operator route families.</desc>
    <defs>
      <marker id="ah-route-families" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="385" y="25" width="310" height="72" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="540" y="55" text-anchor="middle">/harness/:harnessName</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="540" y="78" text-anchor="middle">auth-derived resource boundary</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="55" y="160" width="200" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="155" y="189" text-anchor="middle">Sessions</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="155" y="212" text-anchor="middle">message / queue / state / inbox</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="315" y="160" width="200" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="415" y="189" text-anchor="middle">Threads</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="415" y="212" text-anchor="middle">history reads and clone</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="575" y="160" width="200" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="675" y="189" text-anchor="middle">Background tasks</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="675" y="212" text-anchor="middle">scoped diagnostics</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="835" y="160" width="200" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="935" y="189" text-anchor="middle">Attachments</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="935" y="212" text-anchor="middle">pre-upload/delete</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="185" y="335" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="295" y="364" text-anchor="middle">Channel callbacks</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="295" y="387" text-anchor="middle">inbound / actions</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="445" y="335" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="555" y="364" text-anchor="middle">Activity snapshots</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="555" y="387" text-anchor="middle">read-only reconstruction</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="705" y="335" width="220" height="70" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="815" y="364" text-anchor="middle">Operator routes</text>
    <text style="font: 500 13.5px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="815" y="387" text-anchor="middle">optional internal surface</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M420 97 C320 125 205 135 160 159" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M500 97 C455 125 425 135 418 159" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M580 97 C625 125 665 135 672 159" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M660 97 C760 125 885 135 928 159" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M450 97 C340 190 305 270 298 334" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M540 97 L555 334" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-route-families);" d="M630 97 C760 195 812 270 815 334" />
  </svg>
  <figcaption>Client-facing routes stay inside the authenticated Harness/resource scope; operator routes are a separate protected surface, not alternate client APIs.</figcaption>
</figure>

The table is the canonical index for Harness v1 HTTP methods, paths,
query/body shape, response envelopes, route-specific headers, status-code
mapping, auth/tenant boundaries, and HTTP-only recovery affordances. Detailed
operation semantics are owned by their canonical sections: §4.2 for `Session`
methods, §4.4 for admission/idempotency, §5.1/§5.5/§5.7 for persistence,
close, and crash recovery, §10 for event identity/replay, §13.3 for wire DTOs
and error envelopes, and §13.4 for SDK composition. Route rows cross-reference
those owners instead of redefining their state machines.

For errors, route rows may list the specific status/code pairs emitted by that
route, but §4.5 owns typed Harness error classes and shared detail fields while
§13.3 owns wire `details` shapes, retryability, and SDK rehydration.

**`GET` `/harness/:name/sessions`**

List sessions for the authenticated resource. Supports `?cursor`, `?limit`, and
`?includeClosed`; returns `WireListPage<SessionListItem>` read models, not
storage-only `SessionSummary` rows, including the compact `durableWork`
count/latest-status summary from §5.1. Rows are ordered by
`(lastActivityAt DESC, sessionId DESC)`. List rows do not include raw message
bodies, raw request context, action tokens, provider payloads, claim IDs, or
descendant-owned work.

**`POST` `/harness/:name/sessions`**

Resolve (find-or-create) a session. Body mirrors the local resolver shape from
§4.1 except `resourceId` is always auth-derived; `parentSessionId` is accepted
only to create a child session under an existing parent in the same
`(harnessName, resourceId)` scope. Cold active-session creation is atomic once a
concrete `(harnessName, resourceId, threadId)` is resolved; when a caller
supplies `sessionId` for a pair that already has a different active owner in the
route's Harness namespace, returns `409 harness.session_conflict`. A
`parentSessionId` that would create a descendant beyond
`sessions.maxSubagentDepth` returns `409 harness.subagent_depth_exceeded` before
any `SessionRecord`, thread, workspace, or event is created. Duplicate-active
corruption fails closed as `500 harness.session_corrupt`. Lease contention may
return `409 harness.session_locked` under `lockMode: 'fail'`; storage failures
during create/load/acquire return `503 harness.storage`.

**`GET` `/harness/:name/sessions/:sessionId`**

Get the `SessionSnapshot` read model for state reads and reconnect, including
the bounded `durableWork` window from §5.1. The durable-work projection is
read-only and redacted; detailed channel rows remain under
`/channel-diagnostics`, background-task diagnostics remain under scoped
background-task routes, and message/queue settlement still uses result lookup.
The response includes an `ETag` header derived from the current
`SessionRecord.version`; clients that compute a state patch from this snapshot
may use that value as `If-Match` on `PATCH /state`.

**`DELETE` `/harness/:name/sessions/:sessionId`**

Close (terminate) a session. The server derives `resourceId` from auth and
delegates to the resource-scoped close path in §5.5; cross-resource IDs return
tenant-safe `404`. The route is idempotent, returns only after the close
target's terminal close commits under §5.5, and treats a tenant-verified
retained session that is already closed as a successful no-op. Harness v1 has no
separate async close-status route: clients recover ambiguous DELETE transport
failures by retrying DELETE and/or reading `GET /sessions/:sessionId` as
described in §13.4. Deleted or staged-deleted sessions remain tenant-safe
not-found.

**`POST` `/harness/:name/sessions/:sessionId/messages`**

Send a signal-driven message. Body
`{ content, files?, admissionId?, ...overrides }`, where wire overrides are only
serializable fields such as `model`, `mode`, capability-gated `yolo`, and
caller-writable `requestContext.app`; `addTools` is not sendable. Returns
`MessageAdmissionResponse` (§13.3) with `runId`, `signalId`, and
duplicate-admission status. §4.2 owns busy-independence, settlement, and
stream-form semantics; §4.4 owns `admissionId` hashing/conflicts; §5.1/§5.7 and
§13.3 own retained evidence, tombstones, and lookup responses. This route never
maps busy state to `409 harness.busy`; admission errors map to
`400 harness.validation`, `409 harness.session_closing`,
`404 harness.session_closed`, `503 harness.storage`,
`409 harness.override_conflict`, `403 harness.forbidden`,
`409 harness.attachment_unavailable`, or `409 harness.admission_conflict`.

**`POST` `/harness/:name/sessions/:sessionId/messages?sync=true`**

Sync send with typed output (`message({ sync: true, output })`). Body uses
`output: WireSchemaRef` (§13.3), not a local schema object. Malformed,
unsupported, unauthorized, or oversized schema refs reject with
`400 harness.validation` before agent execution. A successful response is `200`
with the typed JSON result body directly: if the implementation uses current
`Agent.generate(..., { structuredOutput })`, the body is the projected
`FullOutput<T>.object` value only, never the `FullOutput` wrapper and never an
`AgentResult` envelope. The projected value must be a JSON response value;
missing or `undefined` objects, schema/object validation failures, tripwires,
model failures, and approval/suspension/question/plan interrupts map to
`HarnessErrorResponse` instead of a successful body. May respond `409 Conflict`
with a `HarnessBusyError` payload. Rejects `admissionId` with
`400 harness.validation` until a generate-admission receipt is specified. This
route is non-retry-safe in v1: SDKs and server middleware must not automatically
retry it after an ambiguous transport failure because a second POST can start a
second sync generate run.

**`POST` `/harness/:name/sessions/:sessionId/messages?stream=true`**

Stream a turn (SSE, `message({ stream: true })`). Admission failures use the
same wire codes as the non-stream route and surface as a normal HTTP error
response before any SSE bytes are written. On success, the response headers
include `Mastra-Run-Id` and `Mastra-Signal-Id` before the SSE body starts; the
body is a live text-tail SSE stream for the admitted signal, not the replayable
`/events` stream. `AgentStream` admission/settlement, disconnect, and retry
semantics are owned by §4.2 and §13.4; terminal status remains recoverable
through the message-result lookup route.

**`GET` `/harness/:name/sessions/:sessionId/message-results/:signalId`**

Read status for an accepted signal-driven message, including for tenant-verified
closed sessions with retained operation evidence. Returns the
`MessageResultResponse` union from §13.3 (`pending`, `completed`, `failed`, or
`expired`). Unknown, unauthorized, deleted, or unretained IDs use tenant-safe
not-found. SDKs use this after SSE replay gaps instead of inferring completion
from `agent_end` or session lifecycle.

**`POST` `/harness/:name/sessions/:sessionId/queue`**

Enqueue an item for sequential delivery. Body
`{ content, files?, admissionId?, ...overrides }`, where wire overrides are only
serializable fields such as `model`, `mode`, capability-gated `yolo`, and
caller-writable `requestContext.app`; `addTools` is rejected. Returns
`QueueAdmissionResponse` (§13.3) with the durable `queuedItemId` and duplicate
flag. Callers use the queue-result route for settlement status. §4.2/§3 own
busy-independence and FIFO drain semantics; §4.4 owns `admissionId`
hashing/conflicts; §5.1/§5.7 and §13.3 own receipts, tombstones, and lookup
responses. This route never maps busy state to `409 harness.busy`; admission
errors map to `400 harness.validation`, `409 harness.session_closing`,
`404 harness.session_closed`, `503 harness.storage`, `403 harness.forbidden`,
`429 harness.queue_full` (body carries `currentDepth` and `maxQueueDepth`),
`409 harness.attachment_unavailable`, or `409 harness.admission_conflict`.

**`GET` `/harness/:name/sessions/:sessionId/queue/:queuedItemId/result`**

Read status for a queued item, including for tenant-verified closed sessions
with retained operation evidence. Returns the `QueueResultResponse` union from
§13.3 (`pending`, `completed`, `failed`, or `expired`); completed/failed results
include `runId` and `signalId` after drain. Unknown, unauthorized, deleted, or
unretained IDs use tenant-safe not-found. SDKs use this after SSE replay gaps
and for duplicate `admissionId` calls that need the first result.

**`POST` `/harness/:name/sessions/:sessionId/skills/:skillName`**

Invoke a skill (`useSkill`). Body
`{ args?, files?, output?, admissionId?, ...overrides }`, where `output`, when
present, is `WireSchemaRef` (§13.3), wire overrides are only serializable fields
such as `model`, `mode`, capability-gated `yolo`, and caller-writable
`requestContext.app`, and `addTools` is not sendable. Without `output`, the
route admits through the signal-driven message path after skill resolution and
returns `MessageAdmissionResponse`; with `output`, it shares the sync-generate
path, rejects `admissionId` with `400 harness.validation`, validates schema refs
before execution, and returns the projected typed JSON body directly with the
same object-only and failure-mapping rules as `/messages?sync=true`. File
normalization failures use `409 harness.attachment_unavailable` before skill
execution. §4.2 owns skill execution and busy semantics; §4.4 owns admission
conflicts. Other first-call busy cases may respond `409 harness.busy`.

**`GET` `/harness/:name/sessions/:sessionId/skills`**

List skills visible to this session after the code-registered +
workspace-discovered resolution chain. Returns `WireHarnessSkillDescriptor[]`;
schema-bearing fields are JSON Schema descriptors, not local schema objects.

**`GET` `/harness/:name/sessions/:sessionId/skills/:skillName`**

Read one resolved `WireHarnessSkillDescriptor`, or `404 harness.skill_not_found`
if no source provides it.

**`GET` `/harness/:name/sessions/:sessionId/events`**

Subscribe to session events (SSE).

**`GET` `/harness/:name/sessions/:sessionId/subagent-inbox`**

List active pending inbox items owned by active descendant subagent sessions
(live or persisted-only) for this parent/root session. Supports `?cursor` and
`?limit`; rows are ordered by
`(requestedAt ASC, owningSessionId ASC, itemId ASC)`. Used by clients after
reconnect to rebuild prompts that were previously surfaced on the parent's SSE
stream. Returns `WireListPage<PendingInboxItem>` using the §13.4 projection;
kind-specific payload fields mirror §5.1. It never answers or proxies the inbox
item.

**`GET` `/harness/:name/sessions/:sessionId/channel-diagnostics`**

Read-only channel diagnostics for one tenant-verified session. Supports
`?cursor` / `?limit` inside each row family as defined by §14.8; a cursor for
one family is not valid for another. Returns the redacted §14.8 diagnostics
view: binding summaries, bounded recent inbox/action summaries,
pending/failed/dead outbox summaries, and per-binding outbound availability. It
derives `resourceId` from auth, rejects caller-supplied `resourceId`, never
returns raw provider payloads, token strings, action responses, provider
secrets, claim IDs, or provider receipt metadata, and never claims, projects,
retries, retargets, migrates, or terminalizes channel rows. Cross-resource IDs
use tenant-safe `404`; deleted sessions are hidden like other public
deleted-session reads.

**`GET` `/harness/:name/sessions/:sessionId/activity`**

Bounded, paginated, redacted read-only activity timeline for one tenant-verified
session. Returns the `SessionActivityTimeline` read model (§5.1) assembled at
read time from existing durable authorities: thread messages, structured
`tool_call` / `tool_result` message parts, retained message-result and
queue-result evidence, session-owned pending inbox projections, goal state and
decisions, `DurableWorkSummary`, redacted channel diagnostics, descendant
subagent summaries when `?includeDescendants=true`, and file-reference metadata
only when those references exist in committed messages, tool results, workspace
projections, outbox summaries, or an application-owned datastore. These file
references are not generated-file bytes or portable artifact fetch handles
(§11.5, §15.3). Supports `?cursor`, `?limit`, and `?includeDescendants` query
parameters. The cursor follows §5.1's
`(occurredAt ASC, sessionId ASC, entryId ASC)` forward-progress rule and is not
durable read state. Derives `resourceId` from auth; cross-resource IDs return
tenant-safe `404`. Closed sessions return reconstructable history while source
authorities are retained; deleted sessions follow normal tenant-safe
deleted/not-found behavior. Evicted sessions assemble from storage authorities
without synthesising missed SSE history (§10.5). When `includeDescendants=true`,
the server recursively includes entries from descendant sessions that share
`(harnessName, resourceId)` and whose parent chain reaches the addressed
session; deleted descendants are omitted. Never returns raw provider payloads,
token strings, claim IDs, hashes, provider receipts, or unredacted errors. Never
settles SDK promises, proves delivery, claims source rows, retries work, or
mutates storage. Gap markers for SSE loss remain client-local per §5.1 and
§13.4; the server does not embed them. The baseline v1 route does not advertise
an HTTP `ETag` and does not support conditional reads from
`SessionRecord.version`: `If-None-Match` must not produce `304 Not Modified`,
and `If-Match` is not a CAS precondition for this read-only route.
Implementations may support `ETag` / `If-None-Match` only if the validator is
computed over every source authority included by the exact
`(sessionId, cursor, limit, includeDescendants)` projection and changes whenever
the returned `SessionActivityTimeline` representation would change. Clients
should treat changes between pages as ordinary read-model drift rather than
replay evidence. The route falls under "Read routes" in the principal
authorization table (§13.2).

**`POST` `/harness/:name/sessions/:sessionId/inbox/:itemId`**

Respond to a pending approval / suspension / question / plan on the owning
session. Body discriminates on `kind` and always carries `responseId`:
`'tool-approval'` carries `{ approved, reason?, responseId }`,
`'tool-suspension'` carries `{ resumeData, responseId }`, `'question'` carries
`{ answer, responseId }`, `'plan-approval'` carries
`{ approved, reason?, responseId }`. Wire calls without `responseId` reject with
`400 harness.validation`; SDKs auto-generate a stable `responseId` when their
local helper allows omission; channel action callbacks pass
`responseId = ChannelActionReceipt.id`. Returns `InboxResponseResult`. The
§4.2/§5.7 response contract owns pending-item consumption, resume, and
idempotency. Route failures map to `404 harness.inbox_item_not_found` for
stale/consumed/missing/wrong-kind/non-owning-session responses,
`409 harness.session_locked` when the parent/root lease is held by another owner
under `lockMode: 'fail'`, `409 harness.inbox_response_conflict` for competing or
mismatched responses, retryable `503 harness.recovery_deferred` for
tool-suspension responses whose receipt committed but resume must wait for the
workflow snapshot, `500 harness.session_corrupt` / `pending_state_corrupt` for
ambiguous multiple-pending state, `409 harness.session_closing`,
`404 harness.session_closed`, or `503 harness.storage`.

**`PATCH` `/harness/:name/sessions/:sessionId/mode`**

Switch mode

**`PATCH` `/harness/:name/sessions/:sessionId/model`**

Switch model

**`GET` `/harness/:name/sessions/:sessionId/om`**

Read the session-scoped observational-memory snapshot. The server derives
`resourceId` from auth, verifies the session/thread belongs to that resource,
resolves the configured OM scope, and returns
`ObservationalMemorySnapshot | null` (§4.8). The response is a redacted
JSON-safe read model over MemoryStorage, not the raw OM row: it excludes raw
config blobs, metadata, buffered chunks/reflections, history generations,
provider clients, live model objects, functions, locks, and processor internals.
Resource-scoped OM may summarize other threads for the same authenticated
resource; cross-resource records are tenant-safe not-found. This route is
read-only, advisory, and never settles operations, proves recovery, claims
memory work, or mutates storage. `RemoteSession.om.getRecord()` uses this route;
`RemoteSession.om.loadProgress()` may use the same read to refresh an
implementation-local OM cache without changing settlement or display-state
semantics.

**`PATCH` `/harness/:name/sessions/:sessionId/om`**

Switch observer/reflector model IDs for the session OM wrapper. Body may include
`{ observerModel?: string, reflectorModel?: string }`; live model objects,
functions, provider clients, raw OM config, threshold/scope changes, and
observation content are rejected. The route requires `If-Match` with the session
`ETag`, runs under the active session lease, updates only
`SessionRecord.observationalMemory` model IDs, advances the session version on
commit, and returns the new resolved OM config read model. Validation, stale
ETag, closing/closed session, lease, authorization, or storage failures reject
before any OM event or display projection is emitted.

**`PATCH` `/harness/:name/sessions/:sessionId/permissions`**

Set policy / grant / revoke. This is the wire form of the commit-scoped
permission mutators: validation fails with `400 harness.validation`; closed,
contended, or stale sessions use the standard session/lease error contract;
durable commit failures return `503 harness.storage`.

**`GET` `/harness/:name/sessions/:sessionId/state`**

Read the current `TState` snapshot. Returns the full state object and an `ETag`
header derived from the current `SessionRecord.version`. Cheaper than
`GET /sessions/:sessionId` when a caller only needs `state`.

**`PATCH` `/harness/:name/sessions/:sessionId/state`**

Apply the §5.1 object-form state merge algorithm — the object form of
`setState`, not RFC 6902 JSON Patch or RFC 7396 JSON Merge Patch. The body is
the partial state object and must be a JSON object (top-level array / scalar
rejected with `400 harness.validation`). Omitted keys are unchanged, explicit
`null` is stored as a value, arrays and nested objects replace as whole
top-level values rather than deep-merging, and remote patches cannot delete
keys. `If-Match` is required and must carry the opaque `ETag` from the state
snapshot the caller used to compute the patch; missing, weak, wildcard, or
multi-value validators reject with `400 harness.validation`. After resource,
lifecycle, and lease checks, a validator mismatch rejects before mutation with
non-retryable `409 harness.state_conflict` carrying the attempted and current
versions. At the state-mutation queue point, after any earlier queued durable
writes, the server rechecks the validator against the latest committed
`SessionRecord.version`, merges under the session lease, validates that the
candidate state can round-trip as a plain JSON object, rejects invalid
candidates atomically with non-retryable `400 harness.state_serialization`,
persists only after that validation as a durable transition (§5.7), returns the
new `ETag`, and emits a `state_changed` event before the response returns.
Durable commit, storage, lease, or closed-session failures after validation use
`harness.storage` or the relevant session/lease error; they do not reuse
`harness.state_serialization`. The validator is the session-level
`SessionRecord.version`, so unrelated durable session writes can conservatively
force a refetch. The functional form of `setState` does not have a wire route —
closures cannot be sent across the boundary; remote callers must compute an
object-form patch locally and PATCH the result.

**`PATCH` `/harness/:name/sessions/:sessionId/thread-settings/:key`**

Write app-owned thread metadata — the wire form of `setThreadSetting`. The
server derives `resourceId` from auth, verifies the session/thread belongs to
that resource, validates `:key` with the §5.1 app metadata key grammar, and
writes only `thread.metadata.app[key]`. The body is `{ value: JsonValue }`;
top-level thread metadata keys, reserved Harness/Mastra/Memory/channel/legacy
keys, and non-JSON values reject with `400 harness.validation` before storage is
touched. The route requires `If-Match` with the session `ETag`; stale validators
reject with `409 harness.state_conflict`, and successful writes return a new
`ETag` after the session version advances. The write is serialized under the
active session lease and must preserve all top-level thread metadata plus
unrelated `metadata.app` keys. It does not emit `state_changed`, does not change
thread titles/list labels, and is never consulted for runtime hydration.

**`PUT` `/harness/:name/sessions/:sessionId/goal`**

Set or replace the session goal (`setGoal`). Returns `GoalState`.

**`GET` `/harness/:name/sessions/:sessionId/goal`**

Read the current session goal, or `null`.

**`POST` `/harness/:name/sessions/:sessionId/goal/pause`**

Pause the current goal. Returns `GoalState | null`.

**`POST` `/harness/:name/sessions/:sessionId/goal/resume`**

Resume the current goal. Returns `GoalState | null`.

**`DELETE` `/harness/:name/sessions/:sessionId/goal`**

Clear the current goal.

**`GET` `/harness/:name/threads`**

List threads for the authenticated resource. Supports `?cursor` and `?limit`;
returns `WireListPage<HarnessThread>` ordered by `(updatedAt DESC, id DESC)`.

**`POST` `/harness/:name/threads`**

Create a thread

**`GET` `/harness/:name/threads/:threadId`**

Get a thread after verifying it belongs to the authenticated resource

**`POST` `/harness/:name/threads/:threadId/clone`**

Clone a thread for the authenticated resource. Body is `CloneThreadRequest`
(§13.3): `{ newThreadId?, title?, copyAppMetadata? }`. The path `:threadId` is
the source thread. The server derives `resourceId` from auth, rejects
caller-supplied resource identity, copies the full committed message history
into a new same-resource thread with fresh message IDs, and returns the new
`HarnessThread`. Cross-resource source IDs return tenant-safe `404`;
same-resource `newThreadId` collisions reject with `400 harness.validation`;
storage failures return `503 harness.storage`. Non-retry-safe in v1 unless
callers provide their own non-colliding `newThreadId` and handle collision as an
ambiguous prior success check.

**`PATCH` `/harness/:name/threads/:threadId`**

Rename a thread

**`DELETE` `/harness/:name/threads/:threadId`**

Delete a thread and cascade-close/delete its sessions for the authenticated
resource through the §5.5 thread-delete lifecycle

**`GET` `/harness/:name/threads/:threadId/messages`**

List messages for a thread after verifying it belongs to the authenticated
resource. Supports `?cursor`, `?limit`, and optional `?order=asc\|desc`; returns
`WireListPage<HarnessMessage>` over the stable `(createdAt, id)` message key.

**`GET` `/harness/:name/threads/:threadId/first-user-message`**

Return the first user message for a thread after verifying it belongs to the
authenticated resource

**`POST` `/harness/:name/threads/first-user-messages`**

Batch first-user-message lookup for authenticated-resource thread IDs;
cross-resource IDs are omitted or returned as not found without leaking
existence

**`GET` `/harness/:name/background-tasks`**

List background tasks for the authenticated resource. Supports `?cursor`,
`?limit`, and task-owned status/date/order filters; the default order is
`(createdAt DESC, taskId DESC)`. The server derives `resourceId` from auth,
rejects caller-supplied `resourceId` with `400 harness.validation`, and applies
`agentId`, `runId`, `threadId`, `taskId`, status/date, ordering, and pagination
filters only inside the derived `(harnessName, resourceId)` scope. Any `total`
field is best-effort for the filtered scope and must not be used as a recovery
or pagination boundary. Tasks whose §5.1 storage row classification cannot prove
the route Harness namespace and authenticated resource directly, or through
`ownerRef` to an owning Harness durable row, are hidden from ordinary clients.
Returned task objects use the redacted §4.8 `BackgroundTask` diagnostic
projection, not the internal storage row.

**`GET` `/harness/:name/background-tasks/:taskId`**

Get one background task after a tenant-safe post-load check. The handler may
load by physical task ID only to find the candidate row; before returning task
metadata, args, result, error, `threadId`, `runId`, or `resourceId`, it verifies
the task's §5.1 owner proof directly or through `ownerRef` to the owning Harness
durable row. Missing, cross-harness, cross-resource, and unscopable rows return
tenant-safe `404`. Returned task objects use the redacted §4.8 `BackgroundTask`
diagnostic projection, not the internal storage row.

**`GET` `/harness/:name/background-tasks/events`**

Live SSE stream of background task events for the authenticated resource. The
server derives `resourceId` from auth, rejects caller-supplied `resourceId`, and
applies `agentId`, `runId`, `threadId`, and `taskId` only after the same scope
intersection. Both the initial running-task snapshot and each later event are
filtered per event. This is a live diagnostic stream, not the §10.5 replay
contract; clients that miss events reconcile through the scoped list/get routes
unless a future durable task-event buffer explicitly upgrades the route.

**`POST` `/harness/:name/sessions/:sessionId/attachments`**

Pre-upload an attachment (multipart). Returns `attachmentId`. See §13.7

**`DELETE` `/harness/:name/sessions/:sessionId/attachments/:attachmentId`**

Drop an unused pre-uploaded attachment

**`POST` `/harness/:name/channels/:channelId/inbound`**

Channel webhook ingress. The Mastra-level `HarnessChannelRegistry` resolves
`:name` + `:channelId` to one harness/channel bridge and provider route context.
The route projects HTTP/provider transport into the §14.2 durable ingress
contract: the adapter verifies the provider payload with that context, the
bridge records `ChannelInboxItem` evidence, resolves `ChannelBinding`, and then
admits through `session.message(...)` or `session.queue(...)` with
`admissionId`. Body shape is adapter-owned. Resource/session IDs in the body are
ignored unless the adapter's trusted policy explicitly maps them. Raw payload
fields are never forwarded as `MessageOptions` / `QueueOptions`; `sync`,
`stream`, `output`, `addTools`, `yolo`, permission grants, state patches, and
session-default mutations are not valid ingress fields.

**`POST` `/harness/:name/channels/:channelId/actions`**

Channel interaction callback for buttons/selects/forms. The registry resolves
the harness/channel pair and the adapter verifies the payload and action token.
The route projects HTTP/provider transport into the §14.5 action-token and
receipt contract, where the claim holder answers the owning session's inbox item
with `itemId` and `responseId`. This route never calls agent approval or resume
APIs directly.


Optional operator/internal routes are not public client APIs. A deployment
mounts them only when it explicitly enables that operator surface and protects
it with operator authentication, authorization, audit logging, and rate
limiting; most deployments run equivalent logic as an internal background
worker.

**`POST` `/harness/:name/channels/:channelId/outbox/dispatch`**

Claim and dispatch pending outbox items for one harness/channel pair. That
worker/route is replaceable execution machinery, while durability and recovery
are defined by `ChannelOutboxItem` rows, claim renewal, retry state, and
provider receipts.

**`GET` `/harness/:name/channels/:channelId/diagnostics`**

Optional operator diagnostic access to channel-wide binding/inbox/action/outbox
summaries and dispatch readiness for one `(harnessName, channelId)` pair. It is
not an ordinary client read route; deployments expose it only under explicit
operator authentication, authorization, audit logging, and rate limiting.

**`GET` `/harness/:name/background-tasks*`**

Optional operator diagnostic access to unscoped or cross-resource
background-task list/get/event observation for one Harness namespace. It is not
an ordinary client read route; deployments expose it only under explicit
operator authentication, authorization, audit logging, and rate limiting.


`getKnownResourceIds()` has no client-facing auto-mounted route and is absent
from `RemoteSession`. If a deployment exposes equivalent resource enumeration
for Studio or operator diagnostics, that surface is operator/admin only:
explicit operator authentication, authorization, audit logging, rate limiting,
and deployment-owned pagination or caps are required. The result is diagnostic
inventory, not proof that an ordinary principal may access any listed resource.

Harness channel routes are mounted only for registry-validated
`(harnessName, channelId)` pairs. A request for an unregistered pair fails at
the registry boundary before adapter verification or body parsing can select a
fallback. Provider-owned routes that call into Harness use the same registry
resolution contract as the direct `/harness/:name/channels/:channelId/...`
routes, even when their public URL is provider-specific.

Channel ingress, channel action callbacks, wakeup-producing schedule/proactive
handoffs, and optional outbox dispatch routes use the worker-readiness refusal
contract in §13.6: a failed durable scope returns `503
harness.worker_unavailable` with `retryable: true` before creating, claiming,
or dispatching durable work rows. Read-only diagnostics are not gated by an
unrelated failed worker scope.

The cross-harness `mastra.harnessChannels.dispatchOutbox(...)` operator surface
(§13.1) has no public HTTP route in v1. Deployments that need it run it
in-process, in an internal worker, or behind their own operator-only route.

**Inbox routing.** `POST /harness/:name/sessions/:sessionId/inbox/:itemId`
requires `:sessionId` to be the **owning session** for the pending item. For
prompts emitted with `source: 'parent'`, that's the same session whose event
stream surfaced the event. For prompts emitted with `source: 'subagent'`, the
owning session is the **subagent's** session — its ID is given by the
`subagentSessionId` field on the event (§10.6), and a UI watching the parent's
SSE stream uses `subagentSessionId` plus the event's `itemId` to pick the right
URL. Posting to a non-owning session returns `404 harness.inbox_item_not_found`.
The server does not maintain a cross-session inbox routing table — `inbox` is a
flat per-session resource.

The same rule applies to subagent sessions that have themselves spawned
grandchild subagents: the inbox lives wherever the prompt was emitted, not on
any ancestor.

Direct descendant inbox writes, including
`POST /harness/:name/sessions/:subagentSessionId/inbox/:itemId`, first verify
the addressed session in the route Harness namespace and authenticated resource
scope. If the addressed session is a descendant, the handler follows the §5.8
distributed child-request routing rule: load the addressed record by
`sessionId`, walk `parentSessionId` to the parent/root authority, and apply the
parent/root `lockMode` on the parent/root lease, never a child lease.
Non-owning-session responses still return `404 harness.inbox_item_not_found`;
parent/root lease contention maps through `HarnessSessionLockedError` /
`harness.session_locked`; Closing or Closed ancestors use the existing close
errors.

Goal judge question auto-answer (§4.7) is an internal owning-session transition,
not a public route and not a caller-selectable actor. Wire callers cannot submit
`goalJudge` receipt metadata, impersonate a judge response through
`requestContext`, or answer a descendant prompt through a parent goal. Human,
SDK, channel, and judge responses that race for the same pending question
resolve through the `POST /inbox/:itemId` stale/consumed/conflict rules above.

`GET /sessions/:sessionId/subagent-inbox` is a recovery/read route for UIs, not
a write path. The server walks `listChildSessions(...)` recursively under the
requested session, filters to descendants the authenticated resource may access,
and returns paged pending prompt summaries from each descendant `SessionRecord`
using the `PendingInboxItem` projection in §13.4. The returned owner ID is the
URL target for `POST /sessions/:subagentSessionId/inbox/:itemId`; the parent
route still rejects attempts to answer the child prompt.

Route protection: every client-facing Harness route is registered with
`requiresAuth: true` route metadata. Authentication is enforced by this route
metadata independent of global `protected` path patterns and independent of the
server's configured API prefix. `requiresAuth: false` (or an explicit public
route declaration) is the only built-in opt-out, and client-facing Harness
routes must not use it. The auth middleware resolves the authenticated
`resourceId`, which is passed to the harness on every call, including session
close/delete, session lookup, thread lookup, and message-log reads. Route
handlers do not call ID-only storage helpers directly as their tenant boundary.
**Clients never send `resourceId` themselves** — the server is the source of
truth. Operator/internal dispatch routes use the deployment's operator auth
scope instead of the per-resource client route boundary before invoking the same
dispatch logic.

Existing non-Harness `/memory/*` and `/memory/network/*` thread, message,
working-memory, clone, update, delete, and save-message routes are not Harness
client routes. During migration, a deployment may expose them to ordinary
Harness clients only behind a Harness wrapper that resolves `harnessName` from
the registry, derives `resourceId` from auth, verifies the candidate
thread/session inside `(harnessName, resourceId)` before returning, listing,
appending, mutating, cloning, or deleting memory rows, and masks missing,
ownerless, cross-resource, or cross-harness candidates as tenant-safe `404`
before row-dependent FGA or principal authorization. Current
`validateThreadOwnership(...)` / `enforceThreadAccess(...)`, raw
`MemoryStorage.getThreadById(...)`, `deleteThread(...)`, `listMessages(...)`,
gateway memory reads, and legacy channel metadata lookup are implementation
material only; if they cannot enforce that contract, the route remains
legacy/operator/internal rather than a public Harness route. Same-resource
principal capability failures still map to `403 harness.forbidden`.
Harness-bound channel callback and `AgentChannels` reuse rules remain governed
by §14.7; metadata lookup is not a substitute for `ChannelBinding` resolution.

For destructive thread delete specifically, a Harness wrapper around
`DELETE /memory/threads/:threadId` or
`DELETE /memory/network/threads/:threadId` must delegate to
`harness.threads.delete(...)` or an equivalent §5.5 thread-delete lifecycle
before calling any raw memory/gateway deletion primitive. Tenant/resource
verification alone is not enough to make a legacy physical delete route a
public Harness thread-delete route.

Background-task observation follows the same rule even when a deployment still
exposes current non-Harness `/background-tasks`, `/background-tasks/:taskId`, or
`/background-tasks/stream` routes during migration. A background-task
read/list/stream route is client-facing only if it derives the resource from
auth, rejects caller-supplied `resourceId`, and intersects every secondary
filter with the derived resource before storage reads, counts, snapshots, or
event emission can broaden scope. Existing flat routes that cannot enforce this
contract are disabled for ordinary clients or, when retained, exposed only as
operator diagnostics under explicit operator authentication, authorization,
audit logging, and rate limiting (the same operator-protection requirements that
gate the operator routes above); they are not a parallel public bypass around
the Harness route namespace. Task rows whose trusted owner fields are missing,
caller-supplied, or cannot be cross-checked against an owning Harness row are
invisible to ordinary clients and require operator diagnostics.

Channel diagnostics observation follows the same tenant-boundary discipline. A
client-facing channel diagnostics route first verifies the addressed session
belongs to the authenticated resource, then intersects every binding, inbox,
action, token-state, and outbox row with the route Harness namespace and that
same resource before returning a redacted summary. Secondary filters such as
`channelId`, `bindingId`, row status, cursor, or date range narrow only inside
that derived scope and must not broaden it. Rows whose trusted owner fields do
not prove the route `(harnessName, resourceId)` or the addressed session /
descendant-session relationship are hidden from ordinary clients and require
operator diagnostics. Channel-wide, provider-wide, cross-resource,
cross-harness, worker-fleet, claim-backlog, and raw storage scans are
operator/internal diagnostics, not public client reads.

**Auth transport.** Client-facing Harness routes accept primary authentication
only through an `Authorization: Bearer ...` header or a deployment-secure
session cookie. Cookie transport must be explicitly configured as a secure
browser credential path, with `HttpOnly`, `Secure`, and a deliberate SameSite /
CORS policy. Bearer/API-equivalent credentials in URL query parameters,
including `apiKey`, are invalid for client-facing Harness routes: they do not
resolve the authenticated principal, do not populate `mastra__authToken`, do not
enter persisted request context or admission hashes, and are not forwarded to
tools, MCP clients, or other downstream integrations. A shared Mastra Server
auth wrapper that extracts a bearer-equivalent query token, or writes the
resolved credential into `mastra__authToken`, does not by itself satisfy this
rule: the Harness route lane must reject bearer/API-equivalent query parameters
before principal resolution and must not let that wrapper's query-token
fallback or downstream-forwarding behavior apply on Harness routes, even when
the lane is implemented by reusing existing auth wrappers.

The only query-parameter auth exception in v1 is an optional compatibility path
for `GET /harness/:name/sessions/:sessionId/events` when a browser-native
`EventSource` client cannot set headers and secure cookie auth is not available.
That route may accept an opaque server-issued subscription token in the query
string. The subscription token is minted only after normal header/cookie
authentication, is scoped to exactly one `(harnessName, resourceId, sessionId,
events route)` tuple, is read-only, has a bounded TTL, expires no later than
session close, and is rejected on every other Harness route, including result
lookup, state, message, queue, inbox, attachment, and operator routes. It is not
the main bearer/API token and is never exposed as a `RequestContext` auth token.
An expired, revoked, malformed, or cross-scope subscription token fails with a
transport auth error before any SSE bytes are written; `Last-Event-ID` is replay
state, not authentication. Servers that support this fallback must avoid caching
the subscription-token response, set a conservative referrer policy for SSE
responses, and redact auth-like query parameters from application access logs.

**Principal authorization.** Tenant lookup is necessary but not sufficient for
high-risk remote operations. Harness routes are registered with explicit route
metadata and use Mastra Server's existing auth/RBAC/FGA hooks, or a
deployment-equivalent authorizer, for the operation being attempted. The spec
names capability classes; products map them to roles, permissions, FGA tuples,
or single-user local policy. A server that cannot prove a required capability
rejects before session admission, pending-item mutation, state commit, or
provider acknowledgement with `403 harness.forbidden`; cross-resource mismatches
still use tenant-safe not-found and do not become `403`. For wire `yolo: true`,
the approval-bypass capability check happens before state-dependent active-run
override conflict checks, so an unauthorized caller does not learn `activeRunId`
or `conflictingFields` by probing a busy session.

The capability class names below are stable Harness v1 route-principal labels.
They are not a new Mastra auth API and they are not the session tool-permission
model from §4.2/§5.1. Route registrations may encode them through
`requiresPermission`, FGA config, RBAC roles, or a deployment authorizer. When a
known principal fails a capability check, `harness.forbidden.details.capability`
carries the failed class name. The classes are independent: one class does not
imply another unless the deployment's auth policy explicitly says so.

Every client-facing route declares `requiresAuth: true`, derives its resource
scope from auth, and has one base capability class. Routes whose authorization
depends on a validated body field or loaded durable row add a conditional class
after that trusted input is known: `yolo: true` adds `harness:approval-bypass`,
and inbox writes first verify the owning session/pending item before applying
`harness:inbox-respond` or `harness:approve`. Provider-owned channel callback
routes use provider verification plus the §14.5 action-token audience policy as
their primary gate; they do not accept browser bearer credentials or
caller-supplied route capability fields in the provider payload.

**`harness:read`**

Operation class: Read routes: session/thread lists, session list and snapshot
read models, messages, skills reads, state reads, goal reads,
observational-memory snapshots, result lookups, scoped background-task
observation, scoped channel diagnostics, and per-session event streams.

Minimum principal rule: Authenticated principal must be authorized to read the
resolved resource/session.

**`harness:interact`**

Operation class: Ordinary interaction: session creation under the authenticated
resource, `message`, `queue`, `useSkill`, attachments, and non-privileged
per-turn `model` / `mode` overrides.

Minimum principal rule: Authenticated principal must be authorized to interact
with the resolved resource/session. The override still follows §4.3 conflict
rules.

**`harness:approval-bypass`**

Operation class: Approval bypass: any wire `yolo: true` on `message`, `queue`,
or `useSkill`.

Minimum principal rule: Explicit approval-bypass capability for the resolved
session/resource. Resource membership, possession of a session ID, or channel
membership is not enough.

**`harness:inbox-respond`**

Operation class: Inbox responses: questions and tool suspensions.

Minimum principal rule: Principal must satisfy the pending item's response
policy for the owning session. Resource membership is sufficient only when the
deployment chooses that policy.

**`harness:approve`**

Operation class: Inbox responses: tool approvals and plan approvals.

Minimum principal rule: Explicit approval capability, original-requester policy,
or operator scope. These responses are safety gates and are not implied by
ordinary resource read/write access.

**`harness:manage`**

Operation class: Session configuration: `PATCH /mode`, `PATCH /model`, goal
mutation routes, observational-memory mutators, and session close.

Minimum principal rule: Explicit session-config/manage capability for the
resolved session/resource.

**`harness:state-write`**

Operation class: State and metadata writes: `PATCH /state`, app-only
`setThreadSetting`, thread rename/delete/clone where exposed.

Minimum principal rule: Explicit state/metadata write capability. State and
app-thread-metadata writes use the session `ETag` / `If-Match` stale-write
contract; thread title/delete/clone behavior is owned by the thread routes.

**`harness:permission-admin`**

Operation class: Permission mutation: `PATCH /permissions` and `permissions.*`
wire calls.

Minimum principal rule: Explicit permission-admin capability before reading or
applying the requested session permission mutation. A session permission payload
cannot grant, replace, or stand in for this route-principal capability.

**`harness:operator`**

Operation class: Operator/internal routes, cross-harness dispatch, channel-wide
or cross-resource channel diagnostics, and unscoped/cross-resource
background-task diagnostics.

Minimum principal rule: Deployment operator auth scope plus explicit operator
authorization, audit logging, and rate limiting. Operator routes do not use the
per-resource client boundary as their only guard.


This matrix resolves the Harness v1 route contract; it does not require a new
Mastra auth API. Current Mastra route metadata such as explicit permissions and
FGA resource checks are sufficient shapes for implementation when Harness routes
declare explicit capability metadata instead of relying only on
convention-derived method/path permissions. Auth transport is constrained by the
rule above. Background-task observation scoping remains a separate
current-server concern tracked by HC-341 rather than part of this Harness route
table.

For direct session routes, caller request context follows the §4.4 allowlist:
the only caller-writable top-level key is `requestContext.app`, and any other
top-level key rejects with `400 harness.validation` before calling
`session.message(...)`, `session.queue(...)`, or `session.useSkill(...)`.
Channel metadata is populated only by the channel bridge and other
harness-owned integration paths after trusted binding resolution (§14.3).

Channel webhook routes are the exception to the browser-auth shape, not to the
tenancy rule. They are gated by provider signature verification, registry route
context, and the configured `ChannelIngressPolicy`. That policy is the
server-side source of truth for mapping platform tenant/thread/user identifiers
to a Harness `resourceId`. A provider payload cannot self-select an arbitrary
Harness, channel, resource, thread, session, mode, model, or permission grant.
If trusted channel policy selects a per-turn `mode` or `model`, the bridge
persists that choice on the `ChannelInboxItem` and replays it unchanged through
the normal session admission rules; it does not mutate session defaults.

Session ownership: every `:sessionId` lookup verifies the session's `resourceId`
matches the authenticated caller before returning. Cross-tenant access returns
`404` (not `403`) to avoid leaking session existence. Subagent sessions inherit
the parent's `resourceId` (§5.6), so the same caller that can address the parent
can address its descendants.
