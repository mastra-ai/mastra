### 5.2i Claim, Retry, and Wakeup Requirements

The optional `initialClaim` on create-or-load is part of the same atomic
operation. It may claim a newly created row. For an existing exact-duplicate
row, it may return `claimed: true` only when that row would be eligible for the
corresponding worker claim scan under the same status, due-time, and
expired-claim rules, except that an `accepted` action receipt duplicate returns
`claimed: false` because the response has already won the pending item. It must
not steal an unexpired claim. Terminal or completed duplicates — inbox
`accepted` / `queued` / `dead`, action `applied` / `conflict` / `dead`, and
wakeup `queued` / `skipped` / `dead` — return `duplicate: true`,
`claimed: false`, and the stored status, result, and conflict reason when
present. The returned `claimed` flag tells the bridge whether this request owns
processing or should only report duplicate status.

Claiming is an atomic state transition. `claimChannelInboxItems` claims only due
rows in the requested status set: unclaimed `received` / `admitted` / retryable
`failed` rows whose `nextAttemptAt` is absent or `<= now`, or rows in those
statuses whose previous `claimExpiresAt <= now`. `claimChannelActionReceipts`
follows the same rule for retryable `received` / `accepted` / `failed` receipts.
`accepted` means the response has won the owning session's pending item and the
recovery worker resumes with the same `responseId` instead of trying to choose a
new response. `claimChannelOutbox` claims only items matching the requested
`harnessName` / `channelId` filter, and only due `pending` rows, retryable
`failed` rows, or rows in `claimed` whose previous `claimExpiresAt <= now`.
Within one `bindingId`, claim scans preserve provider-visible FIFO: they
consider rows by `(createdAt ASC, id ASC)` and must not claim a later
non-terminal row while an earlier non-terminal row for the same binding remains
unsent, retryable, pending, or claimed by another owner. Across different
bindings, claim order is an efficiency choice and provides no user-visible
ordering guarantee. Claim renewal extends the same claim token and returns the
renewed expiry plus storage time; update/mark methods that accept `claimId` must
reject stale or missing claims. Durable adapters MUST use storage-authoritative
time for due-row and expiry comparisons, or explicitly declare a bounded
`maxClockSkewMs`; workers renew at the configured `claimRenewMs` before expiry
and stop if renewal cannot prove ownership remains current.

Retryable failures keep work visible for later claims. For inbox/action rows,
`failed` with `nextAttemptAt` is retryable; `dead` is terminal. Updating a row
to retryable failure increments `attempts`, records `lastError`, sets `failedAt`
/ `updatedAt`, releases the current claim, and stores the next due time.
Updating a row to `dead` records `deadAt` and removes it from automatic claim
scans. For outbox rows, `markChannelOutboxFailed({ retryAt })` records
`lastError`, increments `attempts`, sets `status = 'failed'`, sets
`nextAttemptAt = retryAt`, and releases the current claim;
`markChannelOutboxFailed({ dead: true })` marks it `dead`. A non-dead outbox row
must not remain indefinitely `failed` with a due retry time that
`claimChannelOutbox` cannot see.

Retryable rows require a dedicated recovery worker or polling loop for each
ownership scope. The worker scans for `nextAttemptAt <= now`, claims due rows,
renews claims while processing, and moves exhausted rows to `dead`; the
scheduler/pubsub layer is not by itself this worker.

Workers executing claimed inbox, action, or outbox rows MUST renew the relevant
claim before `claimTtlMs` expires for as long as they continue processing. If
renewal fails, the worker must stop before making any further session mutation
or provider side effect. A renewal failure cannot undo an already-started
downstream call, so exactly-once side effects still depend on the downstream
signal/resume/provider idempotency described in §5.7 and §14.4. The claim rule
prevents stale workers from continuing after ownership has moved.

`HarnessWakeupItem` rows follow the same create-or-load, claim, renewal,
retry, and dead-letter rules. `(harnessName, source, sourceId, fireId)` and
`(harnessName, idempotencyKey)` are unique. Exact duplicate wakeups return the
existing row; same key with a different `payloadHash` is a conflict. A claimed
wakeup queues session work with `admissionId = wakeup.admissionId` and moves to
`queued` only after the `QueuedItem` / `QueueAdmissionReceipt` is durable. A
crash before that transition leaves a due, failed, or stale-claimed wakeup that
another worker can claim. Durable wakeup rows are the recovery handle for
schedule-claim-before-publish and published-not-consumed failures; pubsub
delivery is only an acceleration path.

These rules give webhook retries, action retries, recovery workers, and
dispatcher retries at-least-once recovery with at-most-one accepted Harness
admission or inbox response per idempotency key/hash, assuming the downstream
signal/queue/resume boundary honors the same idempotency key. Cross-harness
claiming, if needed, is a separate operator primitive outside the per-harness
storage API.

`providerId` is stored on every channel row and is validated against the
registry before ingress, action handling, or outbox delivery. It is deliberately
not the external binding uniqueness key: if an operator changes the provider
behind a `(harnessName, channelId)` without migrating bindings, the old active
binding is surfaced as a provider mismatch or `undeliverable` row rather than
allowing the bridge to create a second active owner for the same platform
conversation.
