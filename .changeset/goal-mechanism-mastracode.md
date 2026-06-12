---
'mastracode': minor
---

Reimplement `/goal` on top of the Agent's native goal mechanism instead of a MastraCode-specific judge loop.

The goal is now configured on the agent (`goal: { judge, maxRuns, prompt }`, sourced from the `goalJudgeModel` / `goalMaxTurns` settings) and evaluated **in-loop** by the core goal step, surfaced via the typed `goal` stream chunk. `GoalManager` is now a thin adapter over the agent's `setObjective` / `getObjective` / `clearObjective` / `updateObjectiveOptions` methods backed by the thread-scoped `threadState` store, so the objective persists across thread reloads and process restarts. The old between-turn judge agent (`evaluateAfterTurn`, `maybeGoalContinuation`, the judge memory/tools, and the judge-failure resume retrigger) has been removed.

All user-facing behavior is preserved: `/goal <text>`, `/goal status|pause|resume|clear`, the goal action modal, the judge settings dialog (which now persists updated judge defaults into the active objective record), the status line, Esc-to-pause and the goal input lock, the judge display, and the plan-approval "Use as /goal" flow with plan-mode auto-switch on completion.

The standalone `/judge` command is now the `/goal judge` subcommand, grouping judge configuration under the goal it belongs to (the judge model is only meaningful for evaluating a goal).

The goal judge model is resolved through mastracode's model gateway (`goal.judge` is a resolver function), so provider credentials stored in auth storage are injected — previously the goal scorer received a bare model id and failed with "Could not find API key" for the configured judge. Because evaluation now happens during the run, an objective with no judge model configured anywhere is inert (no judging, no continuation).
