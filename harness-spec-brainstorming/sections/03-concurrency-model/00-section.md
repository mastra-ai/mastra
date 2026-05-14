## 3. Concurrency model

The session has two signal-driven messaging primitives, one explicit
sync-generate message form, plus skill invocation. The model is built on **one
active session owner per `(harnessName, resourceId, threadId)`** (§2.2). That
owner is the admission coordinator for the thread inside one Harness namespace:
it serializes durable queue appends, pending-item transitions, `currentRun`
snapshots, and run-boundary decisions under the session lease (§5.8), then uses
the agent signal/run APIs to execute work. Harness v1 does not add a separate
`ThreadRuntime` or thread lease because the unique active session record is the
thread runtime owner.

**Signal-driven `message(opts)`**

Idle thread: Starts a new run

Active run on this thread: **Drains into the live run** as new user input (no
abort)

Returns: `Promise<AgentResult>`, or `Promise<AgentStream>` if `stream: true`

**`message({ sync: true, output })`**

Idle thread: Starts a fresh sync generate run on a clean turn boundary

Active run on this thread: Throws `HarnessBusyError`

Returns: Typed structured result

**`queue(opts)`**

Idle thread: Sends as the next standalone turn

Active run on this thread: **Holds until idle**, then sends as a fresh turn

Returns: `Promise<AgentResult>` resolved when *this* item's turn completes

**`useSkill(name, opts)`**

Idle thread: Resolves the skill, checks the thread is idle, then runs the
expanded prompt

Active run on this thread: Throws `HarnessBusyError` unless this is an exact
untyped duplicate admission

Returns: Typed or untyped result


Orientation diagram (summary only; the rules below remain authoritative):

<figure>
<svg role="img" aria-labelledby="hx-concurrency-title hx-concurrency-desc" viewBox="0 0 900 360" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
  <title id="hx-concurrency-title">Concurrency primitive routing</title>
  <desc id="hx-concurrency-desc">Operation admission selects message, queue, sync output, or skill. Message signals live runs, queue appends durable FIFO work, sync output fails fast when busy, and every successful path settles by operation identity.</desc>
  <defs>
    <marker id="ah-concurrency" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
    </marker>
  </defs>

  <g transform="translate(25,140)">
    <rect width="135" height="70" rx="10" fill="#eef2ff" stroke="#6366f1" stroke-width="1.5"/>
    <text x="67.5" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#1e1b4b" font-family="Inter, system-ui, sans-serif">Operation</text>
    <text x="67.5" y="49" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">admission</text>
  </g>

  <g transform="translate(225,135)">
    <rect width="150" height="80" rx="10" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
    <text x="75" y="35" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="Inter, system-ui, sans-serif">Session owner</text>
    <text x="75" y="53" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Inter, sans-serif">admission boundary</text>
  </g>

  <g transform="translate(455,35)">
    <rect width="145" height="62" rx="8" fill="#f0fdf4" stroke="#10b981" stroke-width="1.5"/>
    <text x="72.5" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="#064e3b" font-family="Inter, system-ui, sans-serif">message</text>
    <text x="72.5" y="44" text-anchor="middle" font-size="9" fill="#047857" font-family="Inter, sans-serif">sendSignal</text>
  </g>
  <g transform="translate(455,120)">
    <rect width="145" height="62" rx="8" fill="#fff7ed" stroke="#f97316" stroke-width="1.5"/>
    <text x="72.5" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="#7c2d12" font-family="Inter, system-ui, sans-serif">queue</text>
    <text x="72.5" y="44" text-anchor="middle" font-size="9" fill="#9a3412" font-family="Inter, sans-serif">durable FIFO</text>
  </g>
  <g transform="translate(455,205)">
    <rect width="145" height="62" rx="8" fill="#fef2f2" stroke="#ef4444" stroke-width="1.5"/>
    <text x="72.5" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="#7f1d1d" font-family="Inter, system-ui, sans-serif">sync output</text>
    <text x="72.5" y="44" text-anchor="middle" font-size="9" fill="#991b1b" font-family="Inter, sans-serif">busy fails fast</text>
  </g>
  <g transform="translate(455,290)">
    <rect width="145" height="62" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="72.5" y="27" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b" font-family="Inter, system-ui, sans-serif">useSkill</text>
    <text x="72.5" y="44" text-anchor="middle" font-size="9" fill="#475569" font-family="Inter, sans-serif">resolve then admit</text>
  </g>

  <g transform="translate(720,140)">
    <rect width="145" height="70" rx="10" fill="#ecfeff" stroke="#06b6d4" stroke-width="1.5"/>
    <text x="72.5" y="32" text-anchor="middle" font-size="12" font-weight="700" fill="#164e63" font-family="Inter, system-ui, sans-serif">Operation result</text>
    <text x="72.5" y="49" text-anchor="middle" font-size="9" fill="#0e7490" font-family="Inter, sans-serif">signalId / itemId</text>
  </g>

  <path d="M 160 175 L 225 175" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 375 160 C 420 120, 420 65, 455 65" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 375 170 L 455 151" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 375 185 L 455 236" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 375 200 C 420 250, 420 321, 455 321" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 600 66 C 660 75, 685 145, 720 160" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 600 151 L 720 172" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 600 236 C 660 225, 690 195, 720 188" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>
  <path d="M 600 321 C 660 300, 690 215, 720 200" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah-concurrency)"/>

  <text x="450" y="345" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8" font-family="Inter, sans-serif" style="text-transform: uppercase; letter-spacing: 0.08em;">3 — Concurrency primitive routing</text>
</svg>
<figcaption>Orientation summary of how the session owner admits message, queue, sync output, and skill operations; the table and prose above remain authoritative for busy semantics and error mapping.</figcaption>
</figure>

**Signal-driven `message` is busy-independent once admitted.** Multiple
concurrent `message()` calls that omit `sync: true` / `output` (10 users typing
at once) are not rejected merely because a run is already in flight — Slack
semantics once they reach the active session owner and pass admission. In a
multi-process deployment, callers first resolve the same active session through
the lease policy in §5.8; a non-owner process may use deployment-specific
forwarding outside the v1 contract, otherwise it waits for or fails against the
current owner before admission. From the model's perspective accepted signals
show up as a sequence of user inputs interleaved into whatever reasoning context
is live. Each accepted call has a stable `signalId`; settlement is correlated by
that signal rather than run-level lifecycle events, because one run can answer
multiple signals. §4.2 owns the exact `AgentResult` / `AgentStream` promise
behavior and admission failure paths. Signal-driven admission can still fail for
reasons unrelated to busy-ness, but never with `HarnessBusyError`.

The agent signal boundary is therefore part of the Harness v1 contract: once
`sendSignal()` accepts a signal, the runtime must be able to later report
terminal status and result by `signalId` (or explicitly fail/interrupted status)
so local promises, SDK promises, and result lookup routes cannot infer
correlation from best-effort stream ordering. If the underlying agent
implementation cannot provide that per-signal terminal metadata, Harness v1
cannot expose independent `Promise<AgentResult>` semantics for concurrent
`message()` fan-in on top of it.

Per-turn overrides on a `message()` that drains into an *already-active* run are
rejected at admission because the run's surface and run-scoped approval-bypass
policy are committed at start time and a signal cannot mutate them mid-flight.
Overrides on a `message()` that lands while idle apply normally to the new run.
§4.3 owns the exact override fields, error class, and table.

**`queue` is busy-independent.** It is *never* rejected for the reasons that
would cause a `sync` operation to throw `HarnessBusyError` (run in flight,
pending approval/question/plan, non-empty queue) — busy state is precisely what
`queue` is for. Admission can still fail for non-busy reasons such as invalid
`QueueOptions`, closing/closed session, storage failure, or queue depth cap;
§4.2 owns the exact error mapping and §9 owns the depth knob. Admission is
atomic for the conversation: the capacity check and the durable append happen
under the active session's write lease (§5.8) so two concurrent `queue()` calls
for the same `(harnessName, resourceId, threadId)` cannot both observe space and
commit past the cap. Once an item is admitted it follows the queued-item retry
and recovery semantics in §5.7.

Callers that sit behind retrying transports may provide `admissionId` on
signal-driven `message`, `queue`, or untyped `useSkill`. Exact duplicate untyped
`useSkill` admission is checked before the idle/busy check because it reuses the
signal-driven `message(...)` boundary after skill resolution. §4.4, §5.1, and
the §15 invariants own exact retry metadata, conflict behavior, admission-hash
inputs, serializability restrictions, retained signal/receipt evidence, compact
tombstone lifecycle, and post-compaction behavior.
`message({ sync: true, output })` and `useSkill({ output })` bypass this
retry-safe admission path and reject `admissionId` until a separate
generate-admission receipt is defined.

When admitted, items append to the durable FIFO owned by
`SessionRecord.pendingQueue` (§5.1). Because there is at most one active session
for `(harnessName, resourceId, threadId)`, this is also the thread's durable
FIFO inside that Harness namespace. When the thread reaches an idle boundary,
the head of queue drains as a fresh standalone turn. Items run sequentially, one
full turn each — they do not merge with concurrent `message` inputs. §5.1 and
§5.7 own the stored record and replay mechanics; §9 owns the queue-depth cap.

At public operation admission, `HarnessBusyError` no longer fires from
signal-driven interactive `message()`. It fires from the explicit fail-fast
forms:
- `message({ sync: true, output })` — typed structured output needs a clean turn
boundary, so this form skips signals and calls `agent.generate()` directly with
a fresh `runId`. Throws if the thread is busy.
- `useSkill(...)` — skill execution needs a committed turn boundary. Untyped
calls first resolve an exact duplicate `admissionId`, when present, then
otherwise fail fast if the thread is busy before delegating the expanded prompt
to signal-driven `message(...)`. Typed calls with `output` share the direct
sync-generate path and are non-retry-safe in v1.

The same error class is also used inside tool execution for the run-scoped
pending-interaction slot: a second `registerQuestion`,
`registerPlanApproval`, or `suspendTool` call within the same run rejects with
`HarnessBusyError` before any durable write, with `reason` set to the existing
blocking pending kind (§6.1/§6.2). That tool-context conflict does not make
interactive `message()` or `queue()` busy-rejected at admission.

Across active sessions on different `(harnessName, resourceId, threadId)` pairs:
fully parallel. Two callers targeting the same pair inside one Harness namespace
resolve to the same active session and therefore share one admission boundary
instead of racing through independent queues or `currentRun` snapshots.

**Cancellation is not a session concern.** With signals, messaging and stopping
are orthogonal. If a client wants the "STOP/WTF rage abort" pattern, it does
that through the agent layer (or whatever surface owns the run loop) and then
calls `session.message()` for the new content. There is no `session.steer()`, no
`session.abort()`, no `session.clearQueue()` in v1.

**When to use which:**
- `message` — the default. Interactive UI, multi-user fan-in, "send this
whenever the agent can pick it up." Busy-independent; accepted once admission
succeeds.
- `queue` — scripted multi-step flows where you specifically want sequential,
isolated turns ("first refactor X, then add tests, then run the suite"). Or
programmatic agents that need predictable per-prompt boundaries. Niche by
comparison to `message`.
- `message({ sync: true, output })` — headless typed extraction on a clean turn
boundary.
- `useSkill` — invoke a parameterised, named prompt template.

Channel ingress is another caller of these same primitives. After the channel
bridge resolves a binding (§14.1), it admits inbound human input with the
interactive, non-sync `session.message(...)` form by default, or
`session.queue(...)` when trusted channel policy explicitly asks for durable
sequential delivery. It does not request `stream`, `sync`, or `output`; live
chunks and final delivery are projected through session events and the durable
channel outbox. It never calls `agent.stream(...)`, `agent.generate(...)`,
`agent.approveToolCall(...)`, `agent.resumeStream(...)`, or
`agent.resumeGenerate(...)` directly. Retrying or autonomous external callers
first cross a source-specific durable boundary (§5.7) before they reach the
session API. That keeps channel traffic under the same session permissions,
queue, pending inbox, write lease, event ordering, and recovery rules as every
other Harness caller.

---
