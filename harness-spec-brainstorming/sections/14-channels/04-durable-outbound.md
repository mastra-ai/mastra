### 14.4 Durable Outbound

Orientation diagram (state machine and delivery-semantics summary only; the
TypeScript shape, projection-key table, and prose below remain authoritative
for transitions, idempotency, and capability semantics):

<figure>
  <svg role="img" aria-labelledby="hx-outbox-lifecycle-title hx-outbox-lifecycle-desc" viewBox="0 0 1040 520" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-outbox-lifecycle-title">ChannelOutboxItem lifecycle and delivery semantics</title>
    <desc id="hx-outbox-lifecycle-desc">Outbox items move through pending, claimed, sent, failed, and dead states. Per-binding head-of-line ordering blocks later non-terminal rows. The snapshotted delivery semantics on each row decides duplicate suppression and reconciliation behavior.</desc>
    <defs>
      <marker id="ah-outbox-lifecycle" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="40" y="32">ChannelOutboxItem.status</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2.2; rx: 14;" x="40" y="60" width="170" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="125" y="92" text-anchor="middle">pending</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="112" text-anchor="middle">durable enqueue</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2.2; rx: 14;" x="280" y="60" width="170" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="365" y="92" text-anchor="middle">claimed</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="365" y="112" text-anchor="middle">worker holds claim TTL</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2.2; rx: 14;" x="540" y="36" width="170" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="625" y="68" text-anchor="middle">sent</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="625" y="88" text-anchor="middle">providerMessageId + receipt</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="540" y="146" width="170" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="625" y="178" text-anchor="middle">failed (retryable)</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="625" y="198" text-anchor="middle">nextAttemptAt set</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2.2; rx: 14;" x="800" y="146" width="170" height="68" />
    <text style="font: 600 17px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="885" y="178" text-anchor="middle">dead</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="885" y="198" text-anchor="middle">attempts exhausted / fenced</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-outbox-lifecycle);" d="M210 94 L279 94" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-outbox-lifecycle);" d="M450 84 L539 70" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-outbox-lifecycle);" d="M450 110 L539 168" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-outbox-lifecycle);" d="M710 180 L799 180" />
    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 6 6; marker-end: url(#ah-outbox-lifecycle);" d="M540 200 C440 220 380 170 365 128" />

    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="220" y="84">claim under TTL</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="450" y="65">deliver ok</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="450" y="148">deliver fail / claim lost</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="715" y="170">exhausted</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="430" y="215">renewed claim, retry</text>

    <path style="stroke: #ef4444; stroke-width: 1.8; fill: none; stroke-dasharray: 4 4; marker-end: url(#ah-outbox-lifecycle);" d="M125 128 L800 180" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #b91c1c;" x="320" y="160">session_deleted → fence non-terminal rows to dead</text>

    <rect style="fill: #f1f5f9; stroke: #94a3b8; stroke-width: 1.5; stroke-dasharray: 5 5; rx: 12;" x="40" y="240" width="940" height="58" />
    <text style="font: 600 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="60" y="266">Per-binding head-of-line ordering</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="60" y="286">workers deliver one bindingId in (createdAt ASC, id ASC); later non-terminal rows wait until the earlier row settles</text>

    <text style="font: 600 16px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="40" y="332">Snapshotted deliverySemantics gates duplicate suppression on retry</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="40" y="350" width="220" height="124" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="150" y="378" text-anchor="middle">native-idempotency</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="402" text-anchor="middle">provider dedupes by</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="150" y="420" text-anchor="middle">client idempotency key</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="150" y="442" text-anchor="middle">no duplicate side effect</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="280" y="350" width="220" height="124" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="390" y="378" text-anchor="middle">client-message-id</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="402" text-anchor="middle">deterministic platform</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="390" y="420" text-anchor="middle">message id retried safely</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="390" y="442" text-anchor="middle">no duplicate side effect</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="520" y="350" width="220" height="124" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="378" text-anchor="middle">lookup-reconcile</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="402" text-anchor="middle">reconcileDelivery proves</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="630" y="420" text-anchor="middle">not-delivered before retry</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="630" y="442" text-anchor="middle">no duplicate side effect</text>

    <rect style="fill: #fef2f2; stroke: #ef4444; stroke-width: 2; rx: 14;" x="760" y="350" width="220" height="124" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="870" y="378" text-anchor="middle">at-least-once</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="402" text-anchor="middle">no provider reconciliation</text>
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="870" y="420" text-anchor="middle">retries may duplicate</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="870" y="442" text-anchor="middle">duplicate possible</text>
  </svg>
  <figcaption>Outbox rows move through one canonical state machine; the snapshotted delivery-semantics class on each row decides whether retries can duplicate a provider side effect.</figcaption>
</figure>

Live stream consumption is not a durability boundary. In Harness mode, channel
delivery is represented by `ChannelOutboxItem` records.

“Outbound” here means provider-visible channel side effects. It does not include
direct SDK/HTTP return values, SSE delivery to first-party clients, in-memory
stream deltas, or typing indicators. Those live surfaces may enqueue rows
opportunistically when latency matters, but only rows projected from durable
state are recovered after restart. If an event must be visible in Slack,
Discord, Teams, or another provider after retry or restart, it must be
represented by a `ChannelOutboxItem`; transient UI feedback is best-effort and
droppable.

The `ChannelOutboxItem` and `ChannelProviderDeliveryReceipt` row shapes are
declared canonically in §5.1h; §14.4 owns the dispatch state machine,
projection keys, delivery-semantics rules, and recovery behavior described
below.

The outbox is separate from `SessionRecord` so dispatch workers can claim,
retry, and mark delivery without becoming second writers to the session lease.
`idempotencyKey` is unique for a delivery binding and `payloadHash` detects
same-key/different-payload enqueue conflicts before any provider side effect.
`ChannelOutboxItem.id` is an opaque storage row ID, not the projection identity;
recovery, duplicate detection, and provider idempotency use
`(bindingId, idempotencyKey)` plus the stored payload hash, operation identity,
and delivery semantics. Exact duplicate enqueue returns the existing row ID,
while a genuinely missing projected row may allocate a fresh opaque ID. `kind`
describes why Harness projected the row; `operationKind` and optional
`operationName` describe the provider effect the adapter will attempt, such as
message create, message edit, reaction add/remove, file upload, or an
adapter-defined custom operation. The idempotency key should be passed to
providers that support idempotent sends or operation-specific idempotency.
Providers that do not support idempotency must reconcile with operation-specific
receipt or lookup metadata, or tolerate at-least-once delivery.

`deliver(...)` and `reconcileDelivery(...)` are restart-safe adapter operations:
they are rehydratable from `ChannelOutboxItem`, the reloaded `ChannelBinding`,
and registered provider configuration. They must not require a live
`AgentStream`, SDK `Thread`, webhook request/response object, or process-local
handler closure. If a reused channel SDK needs a thread handle, the bridge
constructs it from the durable target identifiers before dispatch.

For `lookup-reconcile` rows, `reconcileDelivery(...)` returns
`{ delivered: false }` only after the adapter authoritatively proves that the
provider-visible operation was not delivered. Provider lookup ambiguity,
transient provider failure, missing local capability for the stored operation,
or an unavailable lookup API is a retryable or terminal dispatch failure
according to policy; it is not treated as permission to send again under a
no-duplicate guarantee.

Edits, reactions, inbox-resolution cards, and other mutations of an existing
platform message must target a durable provider message handle. That handle can
come from a prior sent outbox row's `providerMessageId` or from adapter-owned
durable payload metadata, but not from an in-memory map populated while
consuming a live stream. When the target message is required and cannot be
resolved, dispatch fails or dead-letters according to policy; it does not
silently fall back to a new post unless the outbox item explicitly represents
that fallback.

Outbound guarantees depend on the adapter/provider operation capability
snapshotted onto the outbox row at enqueue time:

- `native-idempotency` — the provider accepts a client idempotency key and
suppresses duplicate sends for that key.
- `client-message-id` — the adapter can choose a deterministic platform message
ID or nonce and retry safely.
- `lookup-reconcile` — the adapter implements `reconcileDelivery(...)` and can
search by stored client metadata after a crash before sending again.
- `at-least-once` — no provider reconciliation exists; duplicate user-visible
posts are possible after a crash between provider acknowledgement and
`markChannelOutboxSent`.

Harness v1 guarantees no duplicate outbox row for one
`(bindingId, idempotencyKey)`: exact duplicate enqueue requires the same
`payloadHash`, `operationKind`, `operationName` (including absence), and
`deliverySemantics`, while same-key enqueue with a different payload hash,
operation identity, or delivery semantics mode is a conflict. It guarantees no
duplicate external side effect only for rows whose `deliverySemantics` is one of
the first three capability classes, and only when provider idempotency or lookup
metadata is scoped correctly to the row's operation and retained for at least
the Harness retry window. If the adapter config changes after a row is enqueued,
dispatch uses the row's stored `operationKind`, `operationName`, and
`deliverySemantics` for retry/reconcile decisions. If the current adapter can no
longer honor that operation or mode, the worker marks the row retryable
`failed` with row `lastError.code = 'delivery_operation_unavailable'` (bare
`HarnessRowErrorCode`, §4.5d; wire surfaces project through §13.3f.1 to
`harness.channel_delivery_unavailable` with the row's `operationKind` /
`operationName` carried in `details`) until attempts are exhausted, then
dead-letters it. This row code is intentionally outbox-scoped: it does not
write `ChannelBinding.closedReason` (§5.1h) and the binding stays active
for everything else.

Dispatch workers claim due `pending` or retryable `failed` rows, renew the claim
while delivering, and stop before any further provider call or sent/dead update
if claim renewal fails. Provider-visible dispatch is sequential for one
`bindingId`: rows for the same binding are dispatched by
`(createdAt ASC, id ASC)`, and a worker must not deliver a later non-terminal
row for that binding while an earlier non-terminal row remains unsent,
retryable, claimed by another owner, or pending. The cost is head-of-line
blocking for that platform conversation; the benefit is that recovery cannot
post a later assistant message, status, or resolution before the earlier
provider-visible delivery intent has settled. No ordering is guaranteed across
different bindings. A successful dispatch records `sentAt`, `providerMessageId`
when available, and an adapter-normalized `providerReceipt`. Provider receipt
metadata is optional post-side-effect audit data: if the adapter cannot
normalize it to `JsonValue`, the worker omits it or stores a redacted JSON
summary rather than retrying a provider call that already succeeded. A worker
that crashes after provider acknowledgement but before
`markChannelOutboxSent(...)` leaves a claim-expired row; the next worker applies
the row's snapshotted operation-specific delivery semantics before retrying.
Outbox retry, claim TTL, claim renewal, clock-skew, batch size, poll interval,
and dead-letter thresholds come from the channel `outbox` recovery config (§9).
If no worker or internal dispatch route is running, rows remain durable but
undelivered; §13.6 requires the affected durable ingress scope to be unavailable
before it accepts more provider-originated work that would depend on that
missing worker.

The outbox worker substrate follows the claim/renew/retry/cleanup pattern of
`packages/core/src/background-tasks/manager.ts` (see §11.6 for the current-vs-v1
mapping). Outbox rows remain their own storage domain under §5.2c because the
current `BackgroundTaskManager` (a) drains pending tasks globally by
`createdAt` and offers no per-binding head-of-line FIFO, (b) dispatches through
pubsub consumer-group routing with no storage-level claim CAS
(`packages/core/src/background-tasks/manager.ts:19-21,134-187`;
`packages/core/src/storage/domains/background-tasks/base.ts:20-54` has no
`claim*` API), (c) carries no channel-binding validation against
`binding.generation` / `providerId`, (d) has no provider delivery semantics or
reconciliation, (e) has no projection-recovery from durable source state, and
(f) has no session-deletion fencing. `ChannelOutboxItem` keeps these
invariants explicit in §14.4 rather than leaking them into the generic
substrate; any future shared `ClaimableWork` surface that subsumes both
`BackgroundTask` reconstructable rows and `ChannelOutboxItem` must preserve
the six invariants above.

Harness-owned dispatch always claims under its owning `harnessName` and optional
`channelId`; `harness.channels.dispatchOutbox(...)` injects the harness name and
cannot dispatch another harness's rows. Cross-harness dispatch is the Mastra
Server `mastra.harnessChannels.dispatchOutbox(...)` operator API (§13.1), not
the per-harness bridge API. This matters because a Mastra Server can share one
Slack provider across multiple harnesses; a support harness worker must not
claim coding harness outbox rows just because both use `channelId: 'slack'`.

Outbox dispatch reloads the binding and validates that
`binding.status === 'active'`, that
`binding.generation === item.bindingGeneration`, that the binding still names
the same `providerId`, and that both provider IDs match current registry config
before delivery. A missing provider, provider mismatch, generation mismatch,
`undeliverable` binding, or `replaced` binding fails or dead-letters the item
rather than silently posting through a different provider or retargeting a
closed conversation. Explicit binding migration may rewrite pending outbox rows
to a replacement binding only as an operator/product repair surface deferred
under §15.3; when implemented, it must preserve idempotency keys for the new
target.

As the channel projection of the §5.5 delete lifecycle, session deletion is
not a channel migration. Force-delete closes active bindings with row
`closedReason: 'session_deleted'` (bare `HarnessRowErrorCode`, §4.5d), marks
pending/claimed/retryable outbox rows that reference the deleted `sessionId`
or `owningSessionId` terminal `dead` with row
`lastError.code = 'session_deleted'` (bare `HarnessRowErrorCode`, §4.5d;
wire projection is `harness.session_deleted`), and leaves already-`sent`
outbox rows as terminal delivery/audit evidence while retained. A dispatcher
whose claim was already in a provider call may still produce an external side
effect; its later sent/dead update must be rejected if the row was fenced by
delete, and duplicate suppression remains governed by the row's snapshotted
`deliverySemantics`.

Typical outbox producers:

- recoverable assistant text and file-reference output, within the §11.5/§15.3
artifact deferral, that should be delivered to the bound platform thread;
- approval, question, suspension, and plan prompts that need channel
buttons/forms;
- durable tool-result notifications projected from persisted run/thread/tool
state;
- status messages for long-running queued or proactive work;
- edits/resolutions that replace an approval card after a user acts;
- stale-card edits/resolutions that disable or explain a previously delivered
  inbox prompt after the prompt can no longer be answered through that card.

Thread-log system messages, hidden model instructions, and provider-internal
system prompts are not projected to the channel outbox unless an application
explicitly records a separate user-visible assistant/tool/status source that
meets the rules below.

SSE replay (§10.5) remains best-effort and in-memory. The channel outbox is
durable delivery, not durable event replay, and recovery projection does not
depend on replaying prior stream events.

Outbox production is a deterministic projection from durable Harness state, not
a live stream callback as the only delivery path. A live stream consumer may
enqueue rows opportunistically for latency, but recovery must be able to
recreate every required row from persisted source state. A run that was
admitted without trusted `requestContext.channel` does not project assistant
output, prompts, status, or tool results to the channel outbox; sessions with
multiple bindings are never broadcast or arbitrarily routed without a
snapshotted `bindingId`.

Every projected row derives its `idempotencyKey` from stable persisted source
identity. Adapter-owned payloads may differ by provider, but the same durable
source under the same binding must normalize to the same JSON payload and
payload hash whether it was enqueued by a live stream consumer or by recovery
projection. Same-key/different-payload, same-key/different-operation, and
same-key/different-delivery-semantics outcomes are projection conflicts, not
overwrite cases.

Canonical projection keys:

**`assistant-message`**

Stable `idempotencyKey` inputs:
`(bindingId, owningSessionId, messageId, partKey, 'assistant-message')`, where
`messageId` and `partKey` come from the committed thread message or stable
message part being delivered. If an adapter intentionally coalesces several
adjacent parts into one provider message, the coalesced segment key must be
persisted or derivable from the committed message-part range.

**`tool-result`**

Stable `idempotencyKey` inputs:
`(bindingId, owningSessionId, runId, toolCallId, resultRevision, 'tool-result')`
from a persisted structured `tool_result` message part or other durable
tool-result summary. If the durable source cannot name the run/tool call and
revision being summarized, it is not projectable.

**`status`**

Stable `idempotencyKey` inputs:
`(bindingId, owningSessionId, statusSourceKind, statusSourceId, statusRevision, 'status')`,
where the source is a persisted run, queued item, wakeup, or
channel/action/outbox row whose transition the deployment has explicitly marked
provider-visible. Live progress, typing, stream deltas, and unpersisted status
callbacks are not status rows.

**`inbox-prompt`**

Stable `idempotencyKey` inputs: `(bindingId, owningSessionId, itemId, kind)` as
defined below.

**`inbox-resolution`**

Stable `idempotencyKey` inputs: Applied responses use
`(bindingId, owningSessionId, responseId, itemId, 'resolution')`; stale visible
prompts use `(bindingId, actionTokenId, staleReason, 'stale-resolution')`.

**`message-edit`**

Stable `idempotencyKey` inputs: The stable key of the target provider-visible
row plus the persisted edit source, such as
`(bindingId, targetOutboxItemId, editSourceKind, editSourceId, 'message-edit')`;
stale-card edits may use the stale-resolution key above.

**`reaction`**

Stable `idempotencyKey` inputs: For Harness-owned `add_reaction` /
`remove_reaction` model tool calls (see below),
`(bindingId, owningSessionId, runId, toolCallId, operationKind, target handle, normalized reaction key, actor scope)`
so repeat add/remove/add cycles within or across turns enqueue distinct rows.
For non-tool reaction projections, a trusted bridge/adapter key that includes
the durable target handle, normalized reaction key, and actor or scope when that
affects provider semantics. Reactions whose target or reaction identity exists
only in a live stream map are not projectable.

**`custom`**

Stable `idempotencyKey` inputs: A trusted bridge/adapter key that is stable
across restart and scoped to the binding. Provider payload fields never supply
this key directly.


Harness v1 ships built-in `add_reaction` and `remove_reaction` model tools as
the outbox-backed substitute for the legacy `AgentChannels.getTools()` reaction
tools that §14 and §14.7 fence out of harness-bound runs. These tools are
exposed to the model only for turns admitted under an active `ChannelBinding`;
the substitute applies to the final merged tool surface after per-turn
`addTools` / `useSkill`, and inheriting subagent turns are evaluated
independently against their own admission. Each invocation enqueues exactly
one `ChannelOutboxItem` row with `kind: 'reaction'`, `operationKind:
'reaction-add'` or `'reaction-remove'` (§9.3), an `operationName` chosen by
the adapter or defaulted from the operation kind, and `deliverySemantics`
resolved through the adapter delivery plan rules above. Adapters whose
`reaction-remove` operation is provider-idempotent SHOULD configure
`native-idempotency` or `client-message-id` for that operation in
`deliverySemanticsByOperation` rather than relying on the `'at-least-once'`
fallback, because retried removes after a worker crash can otherwise produce a
provider-visible duplicate-remove error.

The tools accept a `targetMessageHandle` and a normalized `reactionName`. The
handle resolves either from a prior `sent` outbox row's `providerMessageId` or
from adapter-owned durable payload metadata; when the model targets an inbound
user message, the adapter must normalize the inbound
`requestContext.channel.externalMessageId` into a durable platform message
handle before the bridge enqueues. The reaction actor is the binding's
bot/provider identity (derived from `providerId` and the registered
`ChannelProvider`); `requestContext.channel.actor` is never used as the
reaction author. If no durable handle is resolvable, the tool returns a
non-retryable application error as the `tool_result` the model observes and
does not enqueue a row. The idempotency key follows the `reaction` row in the
projection-key table above, including `runId` and `toolCallId`, so repeat
add/remove/add cycles within or across turns enqueue distinct rows. The
reaction tools enqueue through the bridge's internal outbox API only; they do
not expose `mastra`, `harness`, `channels`, or any operator handle to the tool
execution context.

These built-in tools may be disabled per harness or per binding by deployment
policy. Harness v1 does not ship `edit_message`, `inbox-resolve`, or other
model tools for `message-edit` / `inbox-resolution` outbox kinds; those kinds
remain bridge-projected from durable state per §14.4 and §14.5 and are not
model-callable. Nothing else from `AgentChannels.getTools()` is exposed to a
harness-bound run.

Prompts for approvals/questions/suspensions/plans enqueue their `inbox-prompt`
item in the same durable session transition that records the pending item, using
an idempotency key derived from `(bindingId, owningSessionId, itemId, kind)`.
Before rendering buttons/forms for that prompt, the bridge create-or-loads the
matching `ChannelActionToken` (§14.5) from the same pending item, binding
generation, run, requested time, and audience. Projection after restart reuses
that token record and its stable transport rendering; if the token row was not
created before the crash, projection creates the same deterministic
`actionTokenId` before computing the outbox payload hash.

For subagent-owned prompts, recovery projection resolves the delivery binding
by walking `parentSessionId` toward the root session and selecting the active
channel binding that delivered the parent/root conversation; the outbox item
still records the child `owningSessionId`. If no active ancestor binding exists,
the bridge cannot render a channel prompt and leaves the pending item for direct
session clients or operator repair.

Inbox resolutions for applied responses use an idempotency key derived from
`(bindingId, owningSessionId, responseId, itemId, 'resolution')`, not
`responseId` alone. A stale visible prompt that no longer has a compatible
`ChannelActionReceipt` uses a distinct stale-card key derived from
`(bindingId, actionTokenId, staleReason, 'stale-resolution')`, where
`staleReason` is the trusted terminal reason such as `token_expired`,
`token_revoked`, `binding_mismatch`, `stale_item`, `kind_mismatch`,
`run_mismatch`, or `session_closed`. This projection is allowed only when a
prior `sent` `inbox-prompt` outbox row proves the exact provider message handle
to edit or update. It may enqueue one redacted `inbox-resolution`,
`message-edit`, or `status` item that disables or explains the stale card, but
it never applies the stale response, never calls resume, never posts through a
replacement binding, and never synthesizes a new provider destination. If the
original prompt was not delivered, the provider handle is unavailable, the token
is malformed/forged/unknown, or the failure is actor-specific
(`actor_not_allowed`) rather than globally terminal for the card, the bridge
does not mutate the shared platform card; it returns the action failure or
surfaces only redacted diagnostics through §14.8.

Assistant messages and files use stable message/run/source IDs from committed
persisted thread and agent run state, with `SessionRecord.currentRun` used only
as a correlation pointer when projecting status for a run that has not reached a
terminal thread record yet. File output is projectable only when durable state
contains a stable message part, tool-result summary, workspace path, or
application datastore reference plus enough delivery policy for the adapter to
fetch or render it again; a live stream file chunk or an unreferenced workspace
mutation is not reconstructed as a channel file upload after restart. This
projection does not create a `HarnessArtifact`, artifact fetch route, artifact
event, or artifact-specific outbox kind (§11.5, §15.3).

If a process crashes after durable source state is persisted but before the
outbox row is written, recovery projection recreates missing rows for committed
assistant outputs, recoverable file references, durable tool-result summaries,
persisted provider-visible status transitions, pending prompts, applied
resolutions, and stale-card items with the same idempotency key, payload hash,
operation identity, and delivery semantics mode. Projection scans durable
sources for one binding in stable source order and enqueues rows so their
`(createdAt, id)` dispatch order preserves that source order; if an adapter or
storage backend cannot make tied timestamps deterministic, it must use
monotonic timestamps or a storage-native equivalent rather than relying on
random ID ordering. Enqueue de-dupe makes this safe to run repeatedly, and
same-key/different-operation or same-key/different-mode projection conflicts
rather than overwrites. The owning Harness instance runs
`projectMissingOutboxItems(sessionId)` when it acquires a session lease for a
session with channel bindings, and channel workers may page
`listActiveChannelBindingsForScope(...)` and run the same projection before
claiming a new outbox batch (§13.6). Worker-initiated missing-outbox projection
is still a session-authorized write: the worker may discover candidate bindings
from channel storage, but it must hydrate the owning session through Harness and
enqueue projected rows only through the bridge's idempotent outbox API; it must
not mutate session-local run, queue, pending, thread, or state data as an
independent channel writer. If projection cannot hydrate the session because
`harness.session(...)` rejects with `HarnessLiveSessionLimitError`, the worker
skips that session for the current pass, retries on a later outbox poll/backoff,
and does not mark existing `ChannelOutboxItem` rows `failed` or `dead` from
projection failure alone.

Tool-result outbox items are durable only when the result or summary is
recoverable from persisted run/thread/tool state, such as a structured
`tool_result` message part or a JSON-safe tool summary recorded with stable
`runId`, `toolCallId`, and revision/source time. Partial `text_delta` chunks,
stream iterators, live `tool_start` / `tool_end` events, custom tool progress
events, SSE event IDs, and SSE buffers are not durable source state and are not
reconstructed as channel outbox rows after restart. Interactive channel
`message(...)` fan-in is only as restart-safe as the agent-layer
accepted-signal/run state; scheduled or proactive work that promises delivery
after restart uses `queue(...)` or another durable wakeup that queues session
work.
