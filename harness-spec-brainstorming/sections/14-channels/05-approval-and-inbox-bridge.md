### 14.5 Approval and Inbox Bridge

Orientation diagram (first-response-wins flow only; the TypeScript shapes and
prose below remain authoritative for receipt status, conflict reasons, and
resume idempotency rules):

<figure>
  <svg role="img" aria-labelledby="hx-action-flow-title hx-action-flow-desc" viewBox="0 0 1040 580" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-action-flow-title">Channel action first-response-wins sequence</title>
    <desc id="hx-action-flow-desc">A provider action callback is verified, the action token is loaded, an existing receipt short-circuits, otherwise audience policy gates first-use, the receipt is atomically created and claimed, the owning session applies the response, and the receipt becomes applied once resume completes.</desc>
    <defs>
      <marker id="ah-action-flow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="30" y="28" width="170" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="115" y="62" text-anchor="middle">Provider</text>

    <rect style="fill: #ecfeff; stroke: #06b6d4; stroke-width: 2; rx: 14;" x="260" y="28" width="200" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="360" y="62" text-anchor="middle">Channel bridge / adapter</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="520" y="28" width="220" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="630" y="62" text-anchor="middle">ActionToken + ActionReceipt</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2; rx: 14;" x="800" y="28" width="220" height="56" />
    <text style="font: 600 15px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="910" y="62" text-anchor="middle">Owning session + run</text>

    <line x1="115" y1="84" x2="115" y2="540" style="stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5;" />
    <line x1="360" y1="84" x2="360" y2="540" style="stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5;" />
    <line x1="630" y1="84" x2="630" y2="540" style="stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5;" />
    <line x1="910" y1="84" x2="910" y2="540" style="stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 5 5;" />

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M115 120 L359 120" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="112">1. action callback</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 158 L629 158" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="150">2. verify + load token by transportHash</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 196 L629 196" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="188">3. look up existing receipt by actionTokenId</text>

    <path style="stroke: #94a3b8; stroke-width: 1.8; fill: none; stroke-dasharray: 5 5; marker-end: url(#ah-action-flow);" d="M629 230 L361 230" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #64748b;" x="370" y="222">3a. duplicate → return stored status/result</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 268 L629 268" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="260">4. audience policy + binding generation check</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 306 L629 306" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="298">5. createOrLoad receipt with initial claim</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 344 L909 344" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="336">6. respondTo* (itemId, responseId = receipt.id)</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M910 382 L911 382 L910 382" />
    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 1.8; rx: 10;" x="800" y="370" width="220" height="60" />
    <text style="font: 500 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="910" y="392" text-anchor="middle">verify pending item</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="910" y="412" text-anchor="middle">persist InboxResponseReceipt</text>
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="910" y="428" text-anchor="middle">clear pending · currentRun=resuming</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M909 460 L361 460" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="500" y="452">7. resume completes (resumeAttemptId = responseId)</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M360 498 L629 498" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="370" y="490">8. mark receipt applied</text>

    <path style="stroke: #334155; stroke-width: 2; fill: none; marker-end: url(#ah-action-flow);" d="M361 530 L116 530" />
    <text style="font: 500 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="125" y="522">9. ACK provider</text>
  </svg>
  <figcaption>Channel actions are first-response-wins: token identity gates duplicates, audience policy gates first use, the receipt becomes accepted on session resume start and applied only after the run resume completes under the same responseId.</figcaption>
</figure>

Channel buttons/forms target Harness inbox items, not agent internals.

```ts
type ChannelActionAudience = JsonValue; // deployment-owned pending-item response policy snapshot
```

An `inbox-prompt` outbox item that renders buttons includes an action token
backed by a durable `ChannelActionToken` row. The provider-visible token string
may be a compact signed value, a MACed handle, or an opaque handle lookup, but
it is never process-local: it must verify against or resolve to the durable
token row after restart. Provider payload fields may carry the token string, but
they cannot mint, modify, or revoke it. The token row is non-claimable; it
anchors prompt projection, first-use expiry/revocation, audience policy, binding
generation, and stable token transport rendering before any action receipt
exists. The `ChannelActionToken` row shape is declared canonically in §5.1h;
§14.5 owns token identity, first-use policy evaluation, and revocation
behavior described below.

`actionTokenId` is deterministic for `(harnessName, channelId, providerId,
bindingId, bindingGeneration, resourceId, owningSessionId, itemId, kind, runId,
pendingRequestedAt, audience)`, with `audience` serialized through the Harness
stable-hash canonicalization profile (§5.1). All buttons/forms that answer that
pending item under that delivery binding generation share one `actionTokenId`;
different button choices change the later `responseHash`, not the token group.
`metadataHash` covers the immutable token metadata, including the canonical
JSON `audience` snapshot; it does not include `expiresAt`, `revokedAt`,
`revokedReason`, `transportHash`, or `keyId`. If the rendered token string is
signed, `keyId` and the signing profile used for the row are retained until the
token and any compatible action receipt age out. Key rotation must not change
an already-created token string or make old rendered buttons unverifiable
during their retention window. If the rendered token is an opaque handle, the
bridge stores a lookup hash rather than relying on an in-memory map. `expiresAt`
and `revokedAt` are evaluated from the durable row using storage-authoritative
time or the channel storage clock-skew policy (§5.2).

Channel actions have their own durable receipt. The `ChannelActionReceipt` row
shape is declared canonically in §5.1h; the first-response-wins flow, conflict
reasons, and resume idempotency rules are owned by §14.5 below.

`token_expired` and `token_revoked` are first-use conflict reasons. They are
assigned only when no compatible `ChannelActionReceipt` already exists for the
authenticated `actionTokenId`; expiry or revocation never relabels or hides an
already-recorded receipt.

When the provider posts an action callback, the channel bridge verifies the
provider callback, verifies the token transport, and loads the durable
`ChannelActionToken` by trusted `actionTokenId` or `transportHash` before
trusting any token fields. A malformed, forged, unknown, deleted, or
unresolvable token is rejected before receipt lookup. Once token identity is
trusted, the bridge validates the response shape, normalizes the candidate
`ChannelActionEnvelope.response` to `JsonValue`, computes the canonical
`responseHash` over that same JSON value, and checks for an existing
`ChannelActionReceipt` by `actionTokenId`. If a compatible receipt already
exists, current deployment policy, expiry, or revocation does not block
returning the stored result or current `received` / `accepted` / `failed`
status. A same-token mismatch in immutable token metadata, `audience`, or
`responseHash` is a conflict even when the token has since expired or been
revoked.

Only when no compatible receipt exists does the bridge evaluate the token row's
opaque `audience` policy snapshot against the verified actor from
`ChannelActionEnvelope.actor` and the deployment's pending-item response policy
(§13.2). The audience snapshot is JSON-safe policy data captured when the token
is created; it is not a Harness-defined actor taxonomy. Deployments may express
rules such as provider-verified binding membership, original-requester checks,
linked-resource membership, operator scope, or approval capability in that
policy, but Harness v1 does not persist those as separate token schema
variants. A policy evaluator may consult current deployment authorization state
while interpreting the stored snapshot, but it must not broaden the token beyond
the token's `(harnessName, channelId, resourceId, bindingId,
bindingGeneration, owningSessionId, itemId, kind, runId, pendingRequestedAt)`
identity. Non-JSON action responses reject before creating a first-use
`ChannelActionReceipt`, so invalid provider payloads do not consume the token's
first-response slot. If the provider cannot supply an actor required by the
stored audience policy, or the actor does not satisfy that policy, the callback
is rejected as `actor_not_allowed` before creating a first-use receipt. This is
the channel-action instance of §13.2's principal authorization rule for pending
inbox responses; channel membership or a valid provider signature is not enough
for tool or plan approvals unless the deployment's pending-item policy says so.

After that first-use policy check succeeds, the bridge applies current
expiry/revocation, checks the binding/resource, validates that the binding is
still active with the same generation/provider, and atomically creates or loads
the `ChannelActionReceipt` by `actionTokenId`. If revocation wins before
receipt creation, first use fails as `token_revoked`; if a compatible receipt is
already durable before revocation, duplicate replay still returns the stored
receipt status/result. First response wins means the first
provider-verified, schema-valid response that creates this receipt. The token
metadata is part of that identity check: `harnessName`, `channelId`,
`providerId`, `bindingId`, `bindingGeneration`, `resourceId`, `owningSessionId`,
`itemId`, `kind`, `runId`, `pendingRequestedAt`, and `audience` must match the
pending item that is about to be answered. The newly created receipt snapshots
the authorized `verifiedActor` when one is available so the winning response is
auditable. A stale token for a consumed, replaced, closed, expired, revoked,
actor-disallowed, or different pending item with no compatible existing receipt
is a conflict; it never falls through to agent resume. Globally terminal stale
card cases are projected through §14.4 when a durable prompt target exists; the
action path itself still only records or returns the terminal action result. If
a racing first-use callback creates the receipt between lookup and create, the
bridge follows the returned receipt's duplicate or conflict result instead of
treating the callback as a new expired/revoked first use.

`createOrLoadChannelActionReceipt(...)` returns the persisted receipt. On a
duplicate, the bridge discards any newly generated candidate receipt ID and uses
the returned `receipt.id` as `responseId`. If the route will apply the response
synchronously, it creates the receipt with an initial claim or claims it before
touching the owning session; an exact duplicate never steals an active claim.
Only the holder of a valid receipt claim calls the same owning-session response
method used by HTTP clients:

- `respondToToolApproval(...)`
- `respondToToolSuspension(...)`
- `respondToQuestion(...)`
- `respondToPlanApproval(...)`

The bridge passes both `itemId` and `responseId = ChannelActionReceipt.id` into
those response methods while holding the action receipt claim. Session inbox
response handling must perform one atomic owning-session transition: verify that
the requested item is the pending item of the expected kind, `runId`, and
`requestedAt`; reject any different already-accepted response for that item;
verify that the §4.2 Required Agent Resume Boundary supports idempotent resume
for the pending kind; persist an `InboxResponseReceipt` with
`pendingRequestedAt`; clear the matching pending field; mark
`currentRun.status = 'resuming'`; and only then resume the run. The channel
receipt is not marked `applied` until after that session receipt is durable and
the resume completes; adapters without cross-record transactions rely on this
write order for recovery. The receipt is two-phase: `accepted` means the
response has won the item and recovery must retry the resume with the persisted
response while the session remains busy/resuming; `applied` means the underlying
run resume has completed and the original `InboxResponseResult` can be returned.
The resume call uses `resumeAttemptId = responseId`, so the agent/workflow
resume boundary must be idempotent by that key. If that prerequisite is not
available for a pending-item kind, Harness mode disables channel buttons/forms
for that kind before consuming the pending item. It does not claim a weaker
exactly-once guarantee, because a non-idempotent resume can lose progress after
the workflow snapshot is consumed but before resumed state is durable.

The action worker enters the session only through
`harness.session({ sessionId: owningSessionId, resourceId })` and the normal
inbox response method. That means a provider callback, an action recovery
worker, and a hydrating session owner all serialize on the same owning session
lease. A recovered session owner that scans
`InboxResponseReceipt(status: 'accepted' | 'failed')` either finds the pending
item still unanswered and applies the receipt, finds the pending item already
cleared with the same accepted receipt and resumes with
`resumeAttemptId = responseId` before any channel receipt is marked `applied`,
or finds the receipt already applied/dead and skips it. The checks are ordered
by pending-item existence, `InboxResponseReceipt` status, then
`ChannelActionReceipt` status; an already-applied receipt is skipped. The
session owner never races a channel worker through a separate resume path.

Exact duplicate `actionTokenId` / `responseHash` callbacks return the first
applied result or the current `accepted` / `received` / `failed` status; a
different response hash for the same token group is rejected as a conflict even
if the winning receipt is already `applied`. The provider callback is
acknowledged only after the channel receipt is `applied`, or after the owning
session's `InboxResponseReceipt` lets the bridge reconstruct and mark an
already-applied duplicate result. If a retry observes that the first response
has won the item but resume is still in progress, the bridge may return
`status: 'accepted'` and leave recovery to continue with the same `responseId`.
Transient apply failures leave the receipt claimable in `failed` with
`nextAttemptAt`; exhausted failures become `dead`.

For subagent-attributed pending items, `owningSessionId` is the subagent session
from the event, not the parent. The outbox target can still be the parent/root
channel binding so the prompt appears in the original platform thread.
`ChannelOutboxItem.sessionId` identifies the delivery binding session;
`ChannelOutboxItem.owningSessionId` identifies the session whose inbox must be
answered.

If the ancestor/root binding is replaced after a subagent prompt is rendered,
the old action token remains bound to the old `bindingGeneration`. A callback
through that token fails as `binding_mismatch` / terminal conflict rather than
retargeting the new conversation automatically. Operator migration may issue a
new projected prompt and token under the replacement binding, but it must do so
as an explicit migration that preserves the original pending item identity and
does not apply the stale token response.

Duplicate and concurrent provider action callbacks are idempotent by
`actionTokenId`, not only by provider action ID. All buttons/forms that answer
the same pending inbox item share one token group. The provider's `actionId` is
diagnostic/retry metadata only; it cannot be the first-response key because two
clicks can produce two provider action IDs. Replaying the same token response
returns the first applied result when available, or the current
received/accepted/failed status while recovery is still applying it. A second
response for the same token group with a different `responseHash` returns a
`ChannelActionResult` with `status: 'conflict'` for in-process callers and maps
to `HarnessChannelActionConflictError` / `409 harness.channel_action_conflict`
on the HTTP route; it does not overwrite or downgrade the winning receipt, and
it does not resume the run again. If the token is valid but the owning session
is closed, the item is missing, the item metadata no longer matches, or the item
was consumed by another response without a matching `InboxResponseReceipt`, the
bridge treats the receipt as terminal (`conflict` or `dead`, with
`conflictReason`) instead of retrying or calling resume.

Action receipts are also claimable recovery work, not only provider-retry state.
A crash after `ChannelActionReceipt(status: 'received' | 'accepted')` leaves a
due row that an action recovery worker can claim, renew, and apply with the same
`responseId`; provider retries merely accelerate the same path. If claim renewal
fails, the worker stops before further session mutation.
`HarnessSessionLockedError` from the owning session is retryable and updates
`nextAttemptAt` rather than failing the action. `HarnessLiveSessionLimitError`
from `harness.session({ sessionId: owningSessionId, resourceId })` follows the
same action backpressure path: update the receipt to retryable `failed` with
row `lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode`,
§4.5d; wire projection is `harness.live_session_limit`), set `nextAttemptAt`
using the channel
`actions` retry config, release the claim, and retry later with the same
`responseId`; exhausted attempts mark the receipt `dead` without changing
first-response conflict semantics. Action retry, claim TTL, claim renewal,
clock-skew, batch size, and dead-letter thresholds come from the channel
`actions` recovery config (§9).
