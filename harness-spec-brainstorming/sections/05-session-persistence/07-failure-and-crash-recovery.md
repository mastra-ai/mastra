### 5.7 Failure and crash recovery

Persistence is what makes sessions resumable across server restarts and storage hiccups. This section spells out what survives, what doesn't, and what callers can rely on.

**Flush points.** Writes to storage happen in two flavours:

- **Synchronous (durable transitions).** Queue append, approval / suspension / question / plan registration, mode or model switch, attachment upload, `closeSession`. The originating call only resolves once the write is committed. If the write fails, the call rejects with `HarnessStorageError` and the in-memory mutation is rolled back so the live `Session` and the persisted record stay in agreement.
- **Debounced (non-critical).** Token usage, `lastActivityAt`, display-state snapshots, periodic OM bookkeeping. Coalesced on the `sessions.flushDebounceMs` window. Failures are logged and retried with exponential backoff. After `sessions.maxFlushFailures` consecutive failures (default `5`), the session emits an `error` event and starts rejecting durable operations with `HarnessStorageError` until storage recovers — input is *not* silently buffered in memory.

**Rehydration failures.**

- *Forward-compatible schema drift.* Unknown fields on a stored `SessionRecord` are preserved as-is and rewritten on the next flush. New optional fields added by a later harness version don't break older records.
- *Backward-incompatible schema.* If a required field is missing or malformed, `harness.session(...)` throws `HarnessSessionCorruptError` with `reason: 'schema_incompatible'`. The record is left in storage; callers decide whether to repair or `harness.deleteSession({ sessionId, force: true })`.
- *Corrupted JSON.* Throws `HarnessSessionCorruptError` with `reason: 'parse_failed'`.
- *Pending interrupt with a missing workflow snapshot.* The session hydrates successfully, the corresponding `pendingApproval` / `pendingSuspension` / `pendingQuestion` / `pendingPlan` field is dropped, and an `error` event fires explaining that the suspended turn could not be resumed. The queue continues from the next item. Rationale: replicating the agent layer's `AGENT_RESUME_NO_SNAPSHOT_FOUND` at hydration time would brick the session for a recoverable mismatch (e.g. a snapshot TTL'd out, a workflow store rebuilt).

**Crash mid-turn.** What a freshly hydrated session looks like depends on where the crash hit and which primitive originated the input:

| Crash point | After hydration |
|---|---|
| `message(...)` in flight, signal not yet accepted by the agent | **Lost.** The message was never persisted (Slack semantics — `message` items aren't on `pendingQueue`). The caller's pending promise rejects. The user resends if they want the message delivered. |
| `message(...)` accepted, run started, no suspension | Agent-layer durability: the signal is recorded in the agent's thread log. On hydration, the harness re-attaches via `agent.subscribeToThread(...)`. If the run completed before crash, the assistant turn is in the thread log. If it didn't, the model output is lost — but the user-side input survives in the thread log so they can ask again. |
| `queue(...)` enqueued but not yet drained | Durable. Item still on `pendingQueue`. On the next `harness.session(...)` and once the thread is idle, the head is drained (signalled) as a fresh standalone turn. |
| `queue(...)` drained and signalled, run mid-flight | At-least-once. The item is removed from `pendingQueue` *after* the turn completes. If the crash hit before completion, the item re-runs on hydration. Tools that are not idempotent should guard themselves; `QueuedItem.id` is exposed for de-duping. |
| Suspended on tool approval | `pendingApproval` is rehydrated. The workflow snapshot in `MastraStorage.workflows` survives the crash (it's owned by the agent layer, not the harness). The user responds via `respondToToolApproval(...)`; harness calls `agent.resumeStream({ approved, reason }, { runId })`. |
| Suspended on tool execution (`suspend(data)`) | `pendingSuspension` is rehydrated — the *separate* persisted shape (§5.1), not a relabelled `pendingApproval`. The workflow snapshot survives. The external resumer (webhook handler, operator, …) calls `respondToToolSuspension({ toolCallId, resumeData })`; harness calls `agent.resumeStream(resumeData, { runId })`. The `resumeData` payload is opaque to the harness and flows straight back into the paused tool's continuation. |
| `ask_user` outstanding | `pendingQuestion` is rehydrated. Responding via `respondToQuestion(...)` resumes the underlying agent turn. |
| `submit_plan` outstanding | `pendingPlan` is rehydrated. Responding via `respondToPlanApproval(...)` resumes and (if approved) flips the session's mode. |
| Mid-flush (storage transaction) | The transaction either committed or it didn't. At-least-once for queue items applies as above. |

**Durability boundary.** The harness owns durability for `queue` items pre-acceptance. The agent layer owns durability for everything signal-driven post-acceptance (every `message(...)` and every drained `queue(...)`). The boundary is the `signal.accepted` resolution from `agent.sendSignal(...)`.

**Queue replay.** Items in `pendingQueue` are durable. The head item is removed *after* its turn completes successfully. If a turn was mid-flight at crash time, the item re-runs (at-least-once). Per-turn overrides (`model`, `mode`, `yolo`) stored on the queued item replay with the same overrides. There is no `addTools` field to replay: `queue(...)` rejects `addTools` at admission so a queued item never represents a tool surface that storage cannot reproduce — see §4.3 and §5.1.

**`message` durability is intentional.** Persisting interactive `message` items would defeat the Slack semantic — multiple concurrent users sending messages should not produce a recoverable queue, just live inputs into the conversation. If a caller wants survival across restarts, they use `queue`.

**What this buys us.**

- A laptop tab and a phone tab pointing at the same session see consistent state because both go through `harness.session({ sessionId })` and both hit the same record.
- An OS-level kill of the server doesn't lose pending approvals, queued messages, or in-flight tool suspensions. The next process boot answers `harness.session(...)` calls from storage and the user picks up where they left off.
- Tools and clients don't have to model "is this a fresh session or a resumed one" — the contract is the same either way.
