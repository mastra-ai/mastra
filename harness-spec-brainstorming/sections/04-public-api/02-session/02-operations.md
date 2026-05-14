### 4.2b Operations

```ts
  // Operations
  //
  // `message` — busy-independent once admitted. §3 owns the concurrent fan-in
  //   and idle/active run behavior; this API comment owns caller-visible
  //   promise settlement and admission errors. Delegates to the agent's
  //   `sendSignal()`. For the non-stream form the returned promise
  //   resolves when the assistant turn answering *this* signal completes; for
  //   the stream form (`stream: true`) the outer `Promise<AgentStream>`
  //   resolves at the admission boundary instead — the same per-signal
  //   terminal events settle the stream itself, not the outer admission
  //   promise. Settlement is correlated by the accepted signal's `signalId`:
  //   `message_completed` resolves the non-stream promise with the
  //   operation-scoped `AgentResult` and ends the stream form's `AgentStream`,
  //   and `message_failed` rejects the non-stream promise and errors the
  //   stream. Run-level `agent_end`, `error`, and session lifecycle events
  //   are not per-message settlement boundaries. If the session closes or the
  //   run is interrupted before an answer can be attributed to this signal,
  //   the non-stream promise rejects and the stream errors from the matching
  //   `message_failed` path.
  //
  //   Never throws `HarnessBusyError`, but admission can still fail for
  //   reasons unrelated to busy-ness: `HarnessValidationError` (invalid
  //   options), `HarnessSessionClosingError`, `HarnessSessionClosedError`,
  //   `HarnessStorageError` (signal write failed), `HarnessForbiddenError`
  //   (missing required capability),
  //   `HarnessAdmissionConflictError` (same `admissionId`, different
  //   admission hash), or `HarnessOverrideConflictError` when §4.3 per-turn
  //   override conflict rules apply. If `admissionId` is present, exact
  //   duplicate checks run before current busy/override checks; §4.4 owns the
  //   hash/conflict contract and
  //   §5.1/§5.7/§15 own retained evidence, tombstones, and lookup behavior.
  //
  //   `stream: true` returns `Promise<AgentStream>`. The promise represents
  //     the durable admission boundary and rejects with the same admission
  //     errors as the non-stream form (`HarnessValidationError`,
  //     `HarnessSessionClosingError`, `HarnessSessionClosedError`,
  //     `HarnessStorageError`, `HarnessForbiddenError`,
  //     `HarnessOverrideConflictError`, `HarnessAdmissionConflictError`)
  //     before any `AgentStream` is exposed. Once resolved, the stream facade
  //     carries `runId`, `signalId`, and `textStream: AsyncIterable<string>`;
  //     `textStream` emits text chunks of the turn that answers this signal
  //     correlated by the accepted `signalId`, and the stream itself completes
  //     or errors with this signal's `message_completed` / `message_failed`
  //     boundary, not with run-level `agent_end`. Callers must `await` the
  //     admission promise before consuming `textStream`. Direct iteration of
  //     the `AgentStream` object is not specified in v1. Exact `admissionId`
  //     retries attach only to the retained original signal; `AgentStream` is
  //     not a full transcript recovery path (see §10.5, §13.2, §13.3).
  //   `output: schema` requires `sync: true`. The pair calls `agent.generate()`
  //     directly on a fresh `runId` and is the only `message` form that can
  //     throw `HarnessBusyError` (typed structured output needs a committed
  //     turn boundary, so it cannot interleave via signals). This form rejects
  //     `admissionId` until a separate generate-admission receipt exists and is
  //     not safe for automatic transport retries in v1. A v1 implementation may
  //     use current Mastra `Agent.generate(..., { structuredOutput })` as the
  //     execution primitive, but the public success value is only the generated
  //     `FullOutput<T>.object` projection. The `FullOutput` wrapper, including
  //     text, usage, provider metadata, tool summaries, trace IDs, tripwire
  //     state, suspend payloads, and response metadata, is implementation
  //     material: implementations may normalize supported fields into existing
  //     session events, token usage, message/activity projections, tracing, or
  //     diagnostics, but those fields are not returned as `AgentResult`, exposed
  //     in the typed return value, or wrapped around the HTTP response body.
  //     `agent.generate(...)` errors, `getFullOutput()` errors, `fullOutput.error`,
  //     tripwires, schema/object validation failures, and missing or
  //     `undefined` projected objects reject through the Harness error adapter
  //     instead of resolving with `undefined`. Because v1 has no sync-generate
  //     receipt or result-lookup route, approval, suspension, question, or plan
  //     interrupts on this path fail closed without creating pending inbox
  //     state; callers that need resumable interactive tool work must use a
  //     signal-driven or queued operation.
  //
  // `queue` — busy-independent, defers delivery. Items append to the active
  //   session FIFO and drain as fresh standalone turns at idle boundaries.
  //   §3 owns queue concurrency, §5.1 owns the persisted FIFO/receipts, and
  //   §5.7 owns crash recovery after admission.
  //
  //   Never throws `HarnessBusyError`, but admission can fail with
  //   `HarnessValidationError` (including a runtime reject if `addTools` is
  //   present; see §4.3), `HarnessSessionClosingError`,
  //   `HarnessSessionClosedError`,
  //   `HarnessStorageError`, or `HarnessQueueFullError` (when
  //   `sessions.maxQueueDepth` would be exceeded — see §9). The capacity
  //   check + append are atomic for the active session/thread owner.
  //   `admissionId` hash/conflict behavior is owned by §4.4; queue receipt,
  //   tombstone, retention, and recovery behavior are owned by §5.1/§5.7/§15.
  //   Settlement is correlated by `queuedItemId` (`queue_completed` /
  //   `queue_failed`), with the drained `signalId` included once the item has
  //   crossed the agent signal boundary.
  //
  // `useSkill` — fail-fast skill execution. Resolves the skill, builds the
  //   prompt with args injected. §3 owns the idle-thread requirement and
  //   delegation to signal-driven `message(...)`; when `admissionId` is present,
  //   exact duplicate detection runs before the busy check. §4.4 owns skill
  //   admission hashing/conflicts. Calls with `output` share the sync-generate
  //   path, reject `admissionId`, and are non-retry-safe in v1.
  message(opts: MessageOptions & { stream: true }): Promise<AgentStream>;
  message<S extends PublicSchema>(
    opts: MessageOptions<S> & { sync: true; output: S },
  ): Promise<InferPublicSchema<S>>;
  message(opts: MessageOptions): Promise<AgentResult>;

  queue(opts: QueueOptions): Promise<AgentResult>;

  useSkill<S extends PublicSchema | undefined = undefined>(
    name: string,
    opts?: UseSkillOptions<S>,
  ): Promise<S extends PublicSchema ? InferPublicSchema<S> : AgentResult>;

```
