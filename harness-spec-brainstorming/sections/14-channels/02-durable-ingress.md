### 14.2 Durable Ingress

Channel webhooks are external delivery systems with retries. Subject to the
§13.6 worker-readiness gate for externally reachable durable ingress, Harness
mode acknowledges a provider webhook only after the inbound item is durably
recorded. The `ChannelInboxItem` row shape is declared canonically in §5.1h;
§14.2 owns admission flow, claim semantics, hashing, and recovery behavior.

Admission flow:

1. `HarnessChannelRegistry` resolves the route or provider callback to exactly
one `(harnessName, channelId, providerId)` and passes that route context to the
adapter. Provider payload fields never choose the harness or channel by
themselves.
2. Verify and normalize the provider payload using the channel adapter.
3. Normalize provider attachment inputs — inline bytes, provider file IDs, or
URL-like references — into Harness-owned attachment storage (§5.2) and rewrite
them as `PersistedAttachment` references (§5.1) before the inbox row is created;
URL-like inputs follow §13.7 ingestion policy. Attachment storage keys used in
hashing are deterministic from a provider file ID or content digest under the
§5.1 stable-hash profile; retries of the same provider event must not allocate
fresh random attachment IDs that change the hash. Attachments that exceed
storage policy fail at the bridge; a queued or retried channel item never
depends on live provider bytes, temporary URLs, or process-local file handles.
4. After the §13.6 readiness gate permits this ownership scope to create or
claim durable work, compute an `idempotencyKey` from the provider event/message
ID and a `payloadHash` from the normalized content/files/context. Atomically
create or load `ChannelInboxItem(status: 'received', attempts: 0)` with
`admissionId = inboxItem.id`. If this request will continue admission instead of
only acknowledging the provider, it creates the row with an initial claim or
claims it before step 5; an exact duplicate never steals the active claim.
5. Resolve or create `ChannelBinding`.
6. Resolve the owning `Session` with
`harness.session({ sessionId, resourceId })` or
`harness.session({ threadId, resourceId, sessionId })`.
7. Apply the trusted channel admission policy once. This may choose `delivery`
and per-turn `mode` / `model` overrides, but it cannot set `sync`, `stream`,
`output`, `addTools`, `yolo`, permission grants, state patches, or
session-default mutations. Persist the chosen `delivery`, `mode`, and `model`,
including explicit absence, and compute `admissionHash` from the exact session
admission payload before runtime admission. Recovery replays the persisted
fields and does not re-run policy after `admissionHash` exists.
8. Mark the inbox item `admitted`, then admit the input through the interactive
`session.message(...)` form or through `session.queue(...)` with `admissionId`
and `requestContext.channel`.
9. Mark the inbox item `accepted` after signal acceptance for `message` and
persist `runId` / `signalId`; or mark it `queued` after durable queue append and
persist `queuedItemId`.

Steps 5-9 require a valid inbox claim. A route that only records the durable row
and acknowledges the provider stops after step 4; a recovery worker later claims
the row and starts at the first incomplete step. If an existing `received` /
`admitted` row was recorded before binding resolution and its matching binding
or target session has since been fenced or deleted, recovery marks that same row
terminal `dead` with row `lastError.code = 'session_deleted'` (bare
`HarnessRowErrorCode`, §4.5d; wire surfaces project through §13.3f.1 to
`harness.session_deleted`); it does not retarget
the old provider event to a replacement binding or newly created session. Later
provider events with different idempotency keys may follow the normal binding
replacement policy. The bridge constructs `MessageOptions` / `QueueOptions` from
the persisted inbox row while holding that claim. It must not spread the
provider payload or adapter envelope into the session call. The only
channel-derived fields that cross admission are normalized content, stored
attachments, `admissionId`, `requestContext.channel`, tracing metadata when
configured, and policy-selected `delivery` / `mode` / `model`. Explicit channel
controls that change session defaults or permissions are not inbound message
admission; they need their own verified action/control path that resolves the
binding, hydrates the owning session, and mutates the session under its normal
lease.

Provider ACK is separate from final Harness admission metadata. Once the §13.6
worker-readiness gate allows the ownership scope to create or claim work, the
webhook route may acknowledge as soon as the `received` row is durable, then
finish admission synchronously when the provider timeout budget allows or leave
it for a recovery worker. If that gate is unavailable, the route returns
`503 harness.worker_unavailable` before creating a new inbox row and may do so
without first doing a duplicate lookup. Duplicate provider retries with the same
`idempotencyKey` and `payloadHash` return a 2xx response with the current inbox
status only when the request passes the same readiness gate or the route can
answer read-only from a stored row that is already terminal or accepted/queued
according to §13.6 and §5.2 duplicate rules. They include
binding/session/run/queue metadata only once those fields have been persisted; a
duplicate that finds `received` or `admitted` while the scope is healthy reports
`duplicate: true` and `status: 'received' | 'admitted'` rather than pretending
the final result exists. A duplicate that finds only `received` or `admitted`
while the scope is not ready returns `503 harness.worker_unavailable` so
provider retry remains the backpressure path. A retry with the same
`idempotencyKey` but different `payloadHash` is an admission conflict. If the
first attempt crashed after `received`, the bridge resumes from binding
resolution. If it crashed after `admitted`, the bridge retries session admission
with the same `admissionId` so the signal/queue boundary can de-dupe.

`payloadHash` is computed from adapter-normalized inputs with the Harness
stable-hash canonicalization profile (§5.1). Channel-specific hash material
includes normalized text/files/context, stable sentinel values for missing
optional IDs, and no process-local object identity. File entries hash a stable
provider file ID, deterministic stored attachment ID, or content digest; they do
not hash temporary URLs or freshly allocated random storage IDs. This same
canonicalization rule applies to action `responseHash` and token `metadataHash`
in §14.5; `transportHash` uses the §5.1 raw-token-string rule.

Recovery workers need a claimable inbox surface, not only point lookups. The
bridge uses the atomic create-or-load, conflict detection, claim, renewal, and
guarded update methods defined by the §5.2 storage adapter contract. Binding
resolution is also atomic: two webhook retries racing for the same external
conversation must either observe the same active binding or produce exactly one
replacement chain. The bridge never implements this with a
read-then-unconditional-write sequence.

`HarnessSessionLockedError` during admission is retryable operational
backpressure, not a user-message failure. The bridge updates the row under its
claim to retryable `failed`, increments attempts, records `lastError`, sets
`nextAttemptAt`, releases the claim, and retries later with the same
`admissionId` from the first incomplete step. `HarnessLiveSessionLimitError`
from owning-session hydration or admission follows the same path with row
`lastError.code = 'live_session_limit'` (bare `HarnessRowErrorCode`, §4.5d;
wire projection is `harness.live_session_limit`); after channel
`inbox.maxAttempts` is
exhausted, the bridge marks the row terminal `dead` for operator repair instead
of telling the provider the message was accepted or retargeting the provider
event. Under the §5.5 closing lifecycle, `HarnessSessionClosingError` is
retryable only until the stored `closeDeadlineAt`; the bridge records row
`lastError.code = 'session_closing'` (bare `HarnessRowErrorCode`, §4.5d;
wire projection is `harness.session_closing`), chooses a `nextAttemptAt` no
later than
that deadline, and then re-checks the owning binding/session instead of
admitting to a replacement behind the closing row. `HarnessQueueFullError`
follows the same retry path only when policy configured `delivery: 'queue'` and
the operator wants bounded backlog pressure; otherwise it is a failed/dead
ingress decision. `HarnessOverrideConflictError` from policy-selected `mode` /
`model` on an active `message` admission is not retried unchanged; the bridge
either switches the row to `queue` if policy permits that fallback, or marks it
`dead` for operator repair. `HarnessSessionClosedError` marks the row `dead`
with row `lastError.code = 'session_closed'` (bare `HarnessRowErrorCode`,
§4.5d; wire projection is `harness.session_closed`) unless binding
replacement can resolve a new active session before admission.

Inbox retry, claim TTL, claim renewal, clock-skew, batch size, and dead-letter
thresholds come from the channel `inbox` recovery config (§9).

This requires `session.message(...)` and `session.queue(...)` to honor
`admissionId` (§4.4). If the underlying signal API cannot de-dupe accepted
signals yet, Harness v1 must add that prerequisite before enabling durable
channel ingress. A live-only `agent.stream(...)` fallback is not Harness mode.

`message` remains the default for interactive channel fan-in. `queue` is used
only when the channel policy or caller needs sequential durable turn boundaries,
such as scheduled/proactive work.
