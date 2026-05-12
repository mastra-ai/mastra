### 5.1g Inbox Response Receipt Rules


`inboxResponseReceipts` are keyed by `responseId` for retry lookup and each
receipt is logically unique for the `(itemId, responseId)` pair. Lookup by
`responseId` alone returns the matching receipt; a caller producing the same
`responseId` on a different item is identified as a conflict by the stored
`itemId` match. A `respondTo*` transition runs under the owning session lease: it
verifies the pending field is present, checks `itemId`, `kind`, `runId`, and
`requestedAt`, verifies no other pending field references the same `runId`,
rejects same-`responseId` different-`responseHash` conflicts, and verifies that
the §4.2 Required Agent Resume Boundary supports idempotent resume for this
pending kind and resume method. That support check happens before the pending
field is cleared or an `accepted` receipt is written; unsupported retryable
resume fails closed without consuming the pending item. Once supported, the
transition persists the `InboxResponseReceipt`, clears the pending field, marks
`currentRun.status = 'resuming'`, and only then calls the agent/workflow resume
boundary with `resumeAttemptId = responseId`. If the same run has multiple
pending fields, the method rejects with `HarnessSessionCorruptError` /
`pending_state_corrupt` and does not apply any response.

Goal judge question auto-answers (§4.7) are ordinary question
`InboxResponseReceipt` rows with deterministic `responseId` and the optional
`goalJudge` metadata above. The metadata is audit/correlation data only: it does
not create a new responder class, does not bypass first-response-wins, and does
not let recovery resume by any boundary other than
`resumeAttemptId = responseId`.

Only direct in-process local calls already scoped to the single pending item of a
kind may omit `itemId` and `responseId`; the session resolves the pending item
and mints a response ID under the same lease only after proving the item still
exists and the run has no ambiguous sibling pending field. On wire-level
`POST /inbox` calls `itemId` is always present in the URL path and `responseId`
is always carried in the body (SDKs auto-generate a stable responseId when the
caller omits it). Retrying external transports, including channel actions, must
provide both `itemId` and `responseId`.
