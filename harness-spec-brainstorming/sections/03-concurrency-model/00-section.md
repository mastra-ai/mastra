## 3. Concurrency model

The session has two messaging primitives plus skill invocation. The model is built on **agent signals**: the agent owns the per-thread run loop and exposes `subscribeToThread()` + `sendSignal()`. The harness/session is a control surface over that, not the runtime.

| Operation | Idle thread | Active run on this thread | Returns |
|---|---|---|---|
| `message(opts)` | Starts a new run | **Drains into the live run** as new user input (no abort) | `Promise<AgentResult>`, or `AgentStream` if `stream: true`, or typed result if `output` is set |
| `queue(opts)` | Sends as the next standalone turn | **Holds until idle**, then sends as a fresh turn | `Promise<AgentResult>` resolved when *this* item's turn completes |
| `useSkill(name, opts)` | Runs the skill (delegates to `message`) | Throws `HarnessBusyError` | Typed or untyped result |

**`message` is busy-independent.** Multiple concurrent `message()` calls (10 users typing at once) all deliver regardless of in-flight state — Slack semantics. From the model's perspective they show up as a sequence of user inputs interleaved into whatever reasoning context is live. Each caller's promise resolves independently when the run produces an assistant turn answering their signal. As with `queue`, admission can still fail for reasons unrelated to busy-ness — invalid options, closed session, storage failure on the signal write — but never with `HarnessBusyError`.

Per-turn overrides (`model`, `mode`, `addTools`) on a `message()` that drains into an *already-active* run are rejected at admission with `HarnessOverrideConflictError`: the run's surface is committed at start time and a signal cannot mutate it mid-flight. Overrides on a `message()` that lands while idle apply normally to the new run. See §4.3 for the full table.

**`queue` is busy-independent.** It is *never* rejected for the reasons that would cause a `sync` operation to throw `HarnessBusyError` (run in flight, pending approval/question/plan, non-empty queue) — busy state is precisely what `queue` is for. It can still be rejected at admission time for reasons that have nothing to do with busy-ness: invalid `MessageOptions` (`HarnessValidationError`), a closed session (`HarnessSessionClosedError`), storage failure on the durable append (`HarnessStorageError`), or the per-session queue depth cap being reached (`HarnessQueueFullError`, see below). Admission is atomic per session: the capacity check and the durable append happen under the session's write lease (§5.8) so two concurrent `queue()` calls cannot both observe space and commit past the cap. Once an item is admitted it follows the queued-item retry and recovery semantics in §5.7.

When admitted, items append to a per-session FIFO held in `SessionRecord.pendingQueue` (durable). When the thread reaches an idle boundary, head of queue is drained as a fresh standalone turn. Items run sequentially, one full turn each — they do not merge with concurrent `message` inputs. The cap on this FIFO is configured via `sessions.maxQueueDepth` (§9; default unbounded).

`HarnessBusyError` no longer fires from interactive `message()`. It only fires from the explicit fail-fast forms:
- `message({ output, sync: true })` — typed structured output needs a clean turn boundary, so this form skips signals and calls `agent.generate()` directly with a fresh `runId`. Throws if the thread is busy.
- `useSkill(...)` — same story; skills need a committed turn boundary.

Across sessions: fully parallel. No shared mutable state.

**Cancellation is not a session concern.** With signals, messaging and stopping are orthogonal. If a client wants the "STOP/WTF rage abort" pattern, it does that through the agent layer (or whatever surface owns the run loop) and then calls `session.message()` for the new content. There is no `session.steer()`, no `session.abort()`, no `session.clearQueue()` in v1.

**When to use which:**
- `message` — the default. Interactive UI, multi-user fan-in, "send this whenever the agent can pick it up." Always accepted, always delivered.
- `queue` — scripted multi-step flows where you specifically want sequential, isolated turns ("first refactor X, then add tests, then run the suite"). Or programmatic agents that need predictable per-prompt boundaries. Niche by comparison to `message`.
- `message({ output, sync: true })` — headless typed extraction on a clean turn boundary.
- `useSkill` — invoke a parameterised, named prompt template.

---
