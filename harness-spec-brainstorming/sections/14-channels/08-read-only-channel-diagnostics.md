### 14.8 Read-only Channel Diagnostics

Harness v1 includes a minimal read-only diagnostics contract for Studio and
other first-party clients. It is a bounded projection over existing channel
ledger rows, not a repair API and not another durability boundary. The
projection answers "what happened to this session's channel traffic?" without
letting a client claim work, retry delivery, migrate bindings, retarget rows,
project missing outbox items, mark rows terminal, or inspect raw provider data.
Terminal `dead` or `undeliverable` rows surfaced here are informational:
product-specific repair, binding migration UI, retry/retarget controls, and
stuck-session repair routes remain deferred (§15.3). Manual replay,
administrative reconciliation, per-row retrigger, and diagnostic-surface
rewrite controls are deferred under the same boundary.

The ordinary client route is session-scoped (§13.2). The server first verifies
the addressed session belongs to the authenticated resource, then returns only
rows that prove the same `harnessName` and `resourceId` and either:

- directly reference the addressed `sessionId`;
- reference a descendant `owningSessionId` that belongs to the same resource and
  whose outbox delivery uses the addressed parent/root binding; or
- reference a binding for the addressed session's active or retained closed
  platform conversation.

Closed sessions may return retained diagnostic evidence while the session itself
is still visible to that resource. Deleted sessions and deleted-session
tombstones remain hidden from ordinary clients; retained terminal channel rows
for deleted sessions are operator diagnostics only.

The diagnostic view is paginated and redacted. Each row family uses a
server-configured default limit and maximum limit, stable cursors, and optional
status/date filters. Filters narrow only inside the authenticated session scope.
Cursors are family-specific: a binding cursor is not valid for inbox, action,
token, or outbox summaries, and each cursor binds to the addressed session,
family filters, and ordering. Bindings sort by `(lastOutboundAt DESC,
bindingId DESC)` with `lastInboundAt` used when no outbound time exists; inbox,
action, and outbox summaries sort by `(updatedAt DESC, rowId DESC)` unless the
family-specific route narrows to due/retry scans, which are worker internals and
not this client diagnostic view. A response may include:

- binding summaries: `bindingId`, `channelId`, `providerId`, platform,
  status, generation, mode, safe target label or opaque target handle,
  `lastInboundAt`, `lastOutboundAt`, `closedAt`, `closedReason`,
  `replacedByBindingId`, and `undeliverableReason`;
- inbox summaries: `inboxItemId`, `bindingId`, `channelId`, `providerId`,
  status, delivery choice, `sessionId`, `runId`, `signalId`, `queuedItemId`,
  timestamps, attempts, `nextAttemptAt`, and redacted last-error code /
  retryability;
- action summaries: `receiptId`, `actionTokenId`, `bindingId`,
  `bindingGeneration`, `owningSessionId`, `itemId`, kind, `runId`,
  `pendingRequestedAt`, status, conflict reason, timestamps, attempts,
  `nextAttemptAt`, token expiry/revocation state, and redacted last-error code /
  retryability;
- outbox summaries: `outboxItemId`, `bindingId`, `bindingGeneration`,
  `sessionId`, `owningSessionId`, source, kind, operation kind/name,
  snapshotted delivery semantics, status, attempts, `nextAttemptAt`, `sentAt`,
  and redacted last-error code; and
- per-binding outbound availability: `available`, `unavailable`, or `unknown`
  for that session's active binding, derived from the current registry/provider
  validation state without exposing worker fleet details.

The ordinary projection never returns `ChannelInboxItem.content`,
`attachments`, `requestContext`, provider raw payloads, payload/admission hashes,
`ChannelActionReceipt.response`, token strings, `transportHash`, `metadataHash`,
`keyId`, `verifiedActor` detail beyond a redacted actor label when policy allows
it, `ChannelOutboxItem.payload`, provider secrets, raw provider receipts,
claim IDs, or unredacted `lastError.message`. Provider message IDs may appear
only as opaque delivery handles when the adapter marks them safe for
resource-scoped display.

Channel-wide diagnostics are separate operator/internal surfaces (§13.2). They
may summarize cross-resource binding rows, worker readiness, backlog counts,
claim ages, dead-letter queues, and registry/provider health for one
`(harnessName, channelId)` pair, but only behind explicit operator
authentication, authorization, audit logging, and rate limiting. The
operator-wide diagnostic surface is also read-only in v1: repair, replay,
retry/retarget, migration, administrative reconciliation, and provider-visible
work remain deferred under §15.3. Ordinary clients never get channel-wide,
provider-wide, cross-harness, cross-resource, or worker-fleet views.
