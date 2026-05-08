### 4.7 Goals

A **goal** is a standing objective attached to a session that survives across turns. While a goal is active, after every assistant turn the harness invokes a separate **judge model** to evaluate the latest exchange and decide what to do next:

- **`done`** — the goal is satisfied. The harness emits `goal_done` and stops the loop.
- **`continue`** — the goal is not yet satisfied. The harness enqueues the judge's `reason` as a continuation message via `session.queue(...)`. The continuation runs after any user-supplied messages already in the queue, so user follow-ups always preempt automatic continuations.
- **`waiting`** — the goal is at an explicit human checkpoint. The loop stops auto-continuing but stays active. The next user `message(...)` resumes progress; the judge re-evaluates after the response.

Goals are inspired by the Ralph-loop pattern (Hermes `/goal`, Codex `/goal`). The harness ships them as a first-class primitive because every consumer that has tried to layer them on top of `subscribe` + `queue` has rebuilt the same race conditions (stale judge results, drained queues firing continuations against cleared goals, paused goals being resumed mid-judge).

```ts
interface GoalState {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  judgeAnswersQuestions: boolean;
  lastDecision?: GoalJudgeDecision;
  createdAt: number;
}

interface GoalJudgeDecision {
  decision: 'done' | 'continue' | 'waiting';
  reason: string;
  judgedAt: number;
}

interface SetGoalOptions {
  objective: string;
  judgeModel?: string;            // Default: harness `goals.defaultJudgeModel`
  maxTurns?: number;              // Default: 50
  judgeAnswersQuestions?: boolean; // Default: false. When true, the judge auto-answers
                                  // `ask_user` prompts during goal mode so the assistant
                                  // can keep working unless the goal explicitly demands
                                  // a human checkpoint.
}
```

**Lifecycle.**
1. `session.setGoal({ objective, judgeModel, maxTurns })` — replaces any existing goal, resets the turn counter, persists to `SessionRecord.goal`. Emits `goal_set`.
2. After each assistant turn the session drives, the harness reads `getGoal()`. If status is `'active'`:
    - Calls the judge model with the recent conversation context and the goal objective.
    - If the goal was paused, cleared, or replaced *during* judging, the result is discarded silently. (The TUI implementation learned this the hard way; lifting the manager into the harness lets us own the invariant.)
    - Emits `goal_judged` with the decision.
    - Acts on the decision: enqueues a continuation, marks done, or stops at the human checkpoint.
3. `session.pauseGoal()` / `resumeGoal()` — stop or restart auto-continuations without losing the goal. Emits `goal_paused` / `goal_resumed`.
4. `session.clearGoal()` — drops the goal entirely. Emits `goal_cleared`.

**Preemption.** The judge always runs as a side effect of an assistant turn. Continuation messages are *enqueued*, not sent inline — so anything the user has typed-ahead via `queue(...)` runs first. A user `message(...)` posted while the judge is still evaluating is accepted and signals into the live run as usual; the judge's eventual continuation lands behind any new user input.

**Budget.** `maxTurns` (default 50) is checked *after* each judge call so the final turn is never denied a verdict. When the budget is exhausted, the harness sets status to `'paused'` and emits `goal_paused` with reason `'budget_exhausted'`. Callers can raise `maxTurns` and call `resumeGoal()` to keep going.

**Failures.** If the judge model fails (network error, structured-output validation failure, schema mismatch), the harness fails closed: the goal is moved to `'paused'`, an `error` event fires with the cause, and no continuation is enqueued. This avoids a hot loop of retries against a flaky judge.

**Subagents.** Subagent sessions do *not* inherit the parent's goal. Subagents are explicitly bounded units of work that already terminate when the inner task is done. If a subagent should also drive a sub-goal, the parent tool can call `subagentSession.setGoal(...)` after spawning.

**Persistence.** `GoalState` lives in `SessionRecord.goal` (see §5.1). It survives crashes, server restarts, and session re-hydration. A judge call that was in flight when the process died is *not* resumed — the harness re-evaluates from the most recent assistant turn the next time the session becomes active. This keeps the resume path simple and avoids leaking partial judge state into storage.

**Scope.** Sessions hold at most one goal. Setting a new goal while one is active replaces it (and emits `goal_cleared` then `goal_set`). Nested goals are not in v1; if you need them, set the goal on a child session.

---
