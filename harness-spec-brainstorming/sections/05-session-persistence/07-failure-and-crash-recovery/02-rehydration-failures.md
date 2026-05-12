### 5.7b Rehydration Failures

**Rehydration failures.**

- *Forward-compatible schema drift.* Unknown fields on a stored `SessionRecord`
are preserved as-is and rewritten on the next flush. New optional fields added
by a later harness version don't break older records.
- *Backward-incompatible schema.* If a required field is missing or malformed,
`harness.session(...)` throws `HarnessSessionCorruptError` with
`reason: 'schema_incompatible'`. The record is left in storage; callers decide
whether to repair or
`harness.deleteSession({ sessionId, resourceId, force: true })`.
- *Corrupted JSON.* Throws `HarnessSessionCorruptError` with
`reason: 'parse_failed'`.
- *Corrupted pending state (owner repair only).* If hydration under the owning
  session lease discovers two or more of
  `pendingApproval` / `pendingSuspension` / `pendingQuestion` / `pendingPlan`
  referencing the same non-terminal `currentRun.runId`, the session does not
  choose a winner. It clears those pending fields for the run, clears
  `currentRun.pendingItems`, advances matching `InboxResponseReceipt(status:
  'accepted')` and channel-originated action receipts to terminal failure with
  row `error.code = 'pending_state_corrupt'` (bare `HarnessRowErrorCode`,
  §4.5d), marks the run `interrupted` with the same bare row code on
  `HarnessRunOperationalState.error.code`, emits an `error` `TurnEvent` whose
  payload projects through §13.3f.1 to
  `error.code = 'harness.session_corrupt'` with
  `error.details.reason = 'pending_state_corrupt'`, and lets the queue
  continue from the next item. A single stale pending field with a missing workflow snapshot follows
  the narrower missing-snapshot branch below. Non-owner projections and response
  routes that observe the raw ambiguous state fail closed instead of repairing,
  choosing, or applying a response. Duplicate-active session corruption remains
  fail-closed for normal resolver and route paths and is not auto-repaired by
  hydration.
- *Pending interrupt with a missing workflow snapshot.* The session hydrates
successfully, the corresponding `pendingApproval` / `pendingSuspension` /
`pendingQuestion` / `pendingPlan` field is dropped, and an `error` event fires
explaining that the suspended turn could not be resumed. The queue continues
from the next item. Rationale: replicating the agent layer's
`AGENT_RESUME_NO_SNAPSHOT_FOUND` at hydration time would brick the session for a
recoverable mismatch (e.g. a snapshot TTL'd out, a workflow store rebuilt).
