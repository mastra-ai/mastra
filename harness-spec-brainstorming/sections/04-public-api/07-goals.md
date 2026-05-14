### 4.7 Goals

A **goal** is a standing objective attached to a session that survives across
turns. While a goal is active, after every assistant turn the harness invokes a
separate **judge model** to evaluate the latest exchange and decide what to do
next:

- **`done`** — the goal is satisfied. The harness emits `goal_done` and stops
the loop.
- **`continue`** — the goal is not yet satisfied. The harness enqueues the
judge's `reason` as a continuation message via ordinary FIFO
`session.queue(...)` with a deterministic `continuation.admissionId`. Queue work
whose admission commits before the continuation append runs first; queue work
admitted after it runs behind the continuation. Concurrent queue attempts
linearize under the session lease.
- **`waiting`** — the goal is at an explicit human checkpoint. The loop stops
auto-continuing but stays active. The next user `message(...)` resumes progress;
the judge re-evaluates after the response.

Goals implement a durable single-goal continuation loop inspired by the
Ralph-loop pattern (Hermes `/goal`, Codex `/goal`). The harness ships this
session-local loop as a first-class primitive because consumers that layer
goal-like behavior on top of `subscribe` + `queue` rebuild the same race
conditions (stale judge results, drained queues firing continuations against
cleared goals, paused goals being resumed mid-judge).

Goal evaluation is not a public Workflow run. Implementations may use
`Workflow`/step helpers internally for judge execution
(`packages/core/src/workflows/workflow.ts`,
`packages/core/src/workflows/step.ts`), but the authoritative state is
`SessionRecord.goal` under the session lease because the goal loop is
session-level rather than step-level. Specifically: goals react to
assistant-turn completion (not step completion); they persist
`lastDecision` under session-lease CAS (not as a workflow snapshot under
`MastraStorage.workflows`); they linearize continuations through the
session FIFO queue with deterministic `admissionId` and revision-based
stale-result rejection; and recovery reconciles `lastDecision.source`
against the latest assistant-turn cursor (§5.7c) rather than replaying a
workflow run state. A workflow can model a single goal turn-cycle
internally, but not the persistent reactive loop across turns with session
lifecycle integration.

Orientation diagram (goal loop only; state and lifecycle text below remain
authoritative):

<figure>
  <svg role="img" aria-labelledby="hx-goal-loop-title hx-goal-loop-desc" viewBox="0 0 1040 470" width="100%" style="max-width: 1100px; height: auto; display: block; margin: 1.5rem auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; box-sizing: border-box;">
    <title id="hx-goal-loop-title">Goal judge continuation loop</title>
    <desc id="hx-goal-loop-desc">A committed assistant turn triggers the goal judge, which commits a done, waiting, or continue decision; continue enqueues ordinary FIFO work with a deterministic admission ID.</desc>
    <defs>
      <marker id="ah-goal-loop" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#334155" />
      </marker>
    </defs>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="65" y="185" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="160" y="215" text-anchor="middle">Active goal</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="160" y="238" text-anchor="middle">SessionRecord.goal</text>

    <rect style="fill: #f8fafc; stroke: #94a3b8; stroke-width: 2; rx: 14;" x="325" y="185" width="200" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="425" y="215" text-anchor="middle">Assistant turn</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="425" y="238" text-anchor="middle">committed source turn</text>

    <rect style="fill: #eef2ff; stroke: #6366f1; stroke-width: 2.5; rx: 16;" x="595" y="185" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="690" y="215" text-anchor="middle">Judge model</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="690" y="238" text-anchor="middle">revision-checked call</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="850" y="50" width="150" height="62" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="77" text-anchor="middle">done</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="98" text-anchor="middle">goal_done</text>

    <rect style="fill: #ecfdf5; stroke: #22c55e; stroke-width: 2; rx: 14;" x="850" y="185" width="150" height="62" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="212" text-anchor="middle">waiting</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="233" text-anchor="middle">human checkpoint</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="850" y="320" width="150" height="62" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="925" y="347" text-anchor="middle">continue</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="925" y="368" text-anchor="middle">queue append</text>

    <rect style="fill: #fff7ed; stroke: #f97316; stroke-width: 2; rx: 14;" x="595" y="335" width="190" height="72" />
    <text style="font: 600 18px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #0f172a;" x="690" y="365" text-anchor="middle">FIFO queue</text>
    <text style="font: 500 14px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; fill: #475569;" x="690" y="388" text-anchor="middle">deterministic admissionId</text>

    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M255 221 L324 221" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M525 221 L594 221" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M785 204 C820 165 850 120 883 112" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M785 221 L849 221" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M785 238 C820 280 850 318 884 328" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M850 351 L786 365" />
    <path style="stroke: #334155; stroke-width: 2.2; fill: none; marker-end: url(#ah-goal-loop);" d="M595 371 C470 360 360 305 425 258" />
  </svg>
  <figcaption>The goal loop is durable at the judge decision; continuations re-enter through ordinary queue semantics instead of a hidden priority lane.</figcaption>
</figure>

```ts
interface GoalState {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  judgeAnswersQuestions: boolean;
  // Monotonic token for stale judge-result rejection. Incremented by
  // set/pause/resume/clear and by each committed judge result.
  revision: number;
  lastDecision?: GoalJudgeDecision;
  createdAt: number;
}

interface GoalJudgedTurn {
  runId: string;
  signalId?: string;
  queuedItemId?: string;
  // Optional until the persisted message-log shape exposes stable assistant
  // message identifiers.
  assistantMessageId?: string;
}

interface GoalJudgeDecision {
  // Deterministic for `(sessionId, goalId, source turn)`. This is the
  // session-local judge receipt id, not a worker-scannable row.
  id: string;
  source: GoalJudgedTurn;
  decision: 'done' | 'continue' | 'waiting';
  reason: string;
  continuation?: {
    // Passed to `session.queue(...)` for a `continue` decision and used to
    // load the `QueueAdmissionReceipt` during recovery.
    admissionId: string;
    queuedItemId?: string;
  };
  judgedAt: number;
}

interface SetGoalOptions {
  objective: string;
  judgeModel?: string;            // Default: harness `goals.defaultJudgeModel`
  maxTurns?: number;              // Default: 50
  judgeAnswersQuestions?: boolean; // Default: false. When true, the judge auto-answers
                                  // same-session `ask_user` prompts through the
                                  // normal inbox response path below.
}
```

**Lifecycle.**
1. `await session.setGoal({ objective, judgeModel, maxTurns })` — replaces any
existing goal, resets the turn counter, persists to `SessionRecord.goal`, and
resolves with the committed `GoalState`. Emits `goal_cleared` for the replaced
goal, if any, and `goal_set` only after the durable transition commits.
2. After each assistant turn the session drives, the harness reads `getGoal()`.
If status is `'active'`:
    - Builds a source-turn cursor from the assistant turn's durable run/signal
      identity. `runId` is required; `signalId`, `queuedItemId`, and
      `assistantMessageId` are included when the underlying boundary exposes
      them.
    - If `lastDecision.source` already identifies that source turn, the judge
      is not called again. Recovery honors the stored decision and repairs any
      missing continuation queue admission with the stored
      `continuation.admissionId`.
    - Otherwise, calls the judge model with the recent conversation context and
      the goal objective, remembering the current `(goal.id, goal.revision)`
      and the source-turn cursor being judged.
    - Before committing the result, verifies under the session lease that the
      current goal still has the same `id`, the same `revision`,
      `status: 'active'`, and that the remembered source-turn cursor is still
      the latest durable assistant turn for the session. If the goal was
      paused, cleared, replaced, already judged during the call, or superseded
      by a later completed assistant turn, the result is discarded silently:
      no `lastDecision` update, `turnsUsed` increment, goal event, status
      transition, budget pause, or continuation queue admission is committed.
      The latest turn is evaluated through the normal post-turn lifecycle if
      the goal remains active and no stored `lastDecision.source` covers it.
    - Commits `lastDecision`, `turnsUsed`, and any status transition as a
      commit-scoped durable transition before any goal event is emitted. A
      `continue` decision includes a deterministic
      `continuation.admissionId` derived from the judge receipt and passes it
      to `session.queue(...)`. Implementations should write the receipt and
      queue append atomically when both live in the same `SessionRecord`; if a
      crash leaves a receipt without the queue append, recovery repairs it with
      the same admission id as an ordinary queue append at the repair commit
      point. The existing `QueueAdmissionReceipt` owns FIFO ordering, duplicate
      queue admission, and terminal settlement from that point forward.
    - Emits `goal_judged` only after the durable receipt commits and, for a
      `continue` decision, after the continuation queue append commits (or is
      already observable). After `goal_judged`, emits exactly one of:
      `goal_done` (decision was `done`), `goal_waiting` (decision was
      `waiting`), `goal_paused` (the same durable transition also committed a
      `budget_exhausted` or `judge_failed` pause), or no further goal event
      (decision was `continue` and the goal remains active; the continuation
      queue admission is observable through ordinary queue events).
      `goal_waiting`, like `goal_done` and `goal_paused`, fires exactly once at
      decision-commit time and is not re-emitted on hydration; clients recover
      the waiting state via `getGoal()` / `GoalState.lastDecision`.
3. `await session.pauseGoal()` / `resumeGoal()` — stop or restart
auto-continuations without losing the goal. Resolves with the committed
`GoalState | null` and emits `goal_paused` / `goal_resumed` only after commit.
4. `await session.clearGoal()` — drops the goal entirely. Emits `goal_cleared`
only after commit.

**Question auto-answer.** `judgeAnswersQuestions` is not a second inbox or a
public response route. When it is `true`, the goal is still active, and the
session records a `pendingQuestion` owned by that same session, the harness may
ask the judge model for an answer and apply it through the same internal
`respondToQuestion` transition used by local callers. The judge response uses a
deterministic `responseId` derived from `(sessionId, goalId, goalRevision,
runId, itemId, requestedAt, 'goal-judge-question')`, validates the answer
against the pending question shape (`string` or `string[]` according to the
question mode/options), writes a normal `InboxResponseReceipt` with `goalJudge`
metadata (§5.1), clears the pending field, and resumes with
`resumeAttemptId = responseId`.

Before the receipt is written, the session lease re-checks that the same
`pendingQuestion` still exists, the run has no ambiguous sibling pending field,
the session is not closing or closed, and the goal still has the remembered
`id`, `revision`, and `status: 'active'`. Human, SDK, or channel answers racing
the judge use the ordinary first-response-wins inbox conflict rules: if another
response has already consumed the item, the judge answer is discarded without a
new goal event; if the judge wins, later human/channel responses observe the
normal stale/consumed conflict. A parent goal never scans or answers descendant
subagent inboxes; a subagent prompt can be auto-answered only by a goal active
on that same owning subagent session. If the judge answer call fails or returns
an invalid answer shape, the goal follows the normal judge failure path and
pauses with `reason: 'judge_failed'`; the pending question remains available for
a human response.

**Preemption.** The judge always runs as a side effect of an assistant turn.
Continuation messages are *enqueued*, not sent inline, and they do not get a
hidden priority lane. A user `queue(...)` admitted before the continuation
append runs first; a user `queue(...)` admitted after it runs behind the
continuation. A user `message(...)` posted while the judge is evaluating is
admitted under the normal `message(...)` rules from §3. The eventual
continuation is ordered only relative to durable queue admissions at the point
its append commits under the session lease. A judge decision for an older source
turn is not admitted merely because its continuation append wins the lease;
source-turn freshness is checked before the goal receipt or continuation
admission commits.

**Budget.** `maxTurns` (default 50) is checked *after* each judge call so the
final turn is never denied a verdict. When the budget is exhausted after a
non-`done` decision, the harness persists the decision and the pause in the same
durable transition, does not enqueue a continuation, sets status to `'paused'`,
and emits `goal_paused` with reason `'budget_exhausted'`. Callers cannot mutate
`maxTurns` in place in v1. To continue with a higher cap after
`budget_exhausted`, call `setGoal(...)` with the desired objective/options and
higher `maxTurns`; this replaces the prior goal under the normal set/replace
semantics, resets `turnsUsed`, and emits the normal `goal_cleared` then
`goal_set` sequence after commit. `resumeGoal()` only resumes an existing paused
goal without changing its budget; if the budget still allows no further
non-`done` decision, the goal will pause again with
`reason: 'budget_exhausted'`.

**Failures.** If the judge model fails (network error, structured-output
validation failure, schema mismatch), the harness fails closed: the goal is
moved to `'paused'` in a commit-scoped durable transition, an `error` event
fires with the cause after that commit, and no continuation is enqueued. The
same goal identity, revision, status, and source-turn freshness guard applies
before committing this `judge_failed` pause; a failure from a stale judge call
is discarded silently and must not pause a goal whose latest durable assistant
turn has already moved on. If the process dies before the pause commit, no judge
receipt exists and hydration may evaluate the same source turn again; once the
pause is committed, recovery does not retry a paused goal automatically. This
avoids a hot loop of retries against a flaky judge.

**Subagents.** Subagent sessions do *not* inherit the parent's goal. Subagents
are explicitly bounded units of work that already terminate when the inner task
is done. If a subagent should also drive a sub-goal, the parent tool can call
`await subagentSession.setGoal(...)` after spawning.

**Persistence.** `GoalState` lives in `SessionRecord.goal` (see §5.1). It
survives crashes, server restarts, and session rehydration. A judge call that
was in flight when the process died is *not* resumed. On hydration, the session
owner computes the latest durable assistant-turn cursor and loads
`GoalState.lastDecision` first. If the receipt already covers that source turn,
the judge is not re-run: `done` stays terminal, `waiting` stays active without
auto-continuation, and `continue` repairs or observes the queue admission
identified by `continuation.admissionId`. Only when no receipt exists for the
current source turn and the goal is still active does recovery call the judge
again. The receipt is session-local state guarded by the session lease, not a
separate claimable worker row.

**Scope.** Sessions hold at most one goal. Setting a new goal while one is
active replaces it in one durable transition: if the write fails, the prior
committed goal remains authoritative; if it succeeds, subscribers observe
`goal_cleared` then `goal_set` after commit. Nested goals are not in v1; if you
need them, set the goal on a child session. Core Harness v1 owns only this
session-local durable loop: the goal state, judge receipt, stale-result
rejection, ordinary FIFO continuation admission, recovery repair, routes, and
built-in goal events. Product-specific planners, multi-goal arbitration,
alternate judge strategies, custom goal dashboards, goal-specific read state,
and operator policy layers stay outside core v1 and build on `setGoal(...)`,
`getGoal()`, `GoalState`, and `GoalEvent` instead of replacing the core receipt
and lease boundary.

---
