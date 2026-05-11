---
'@mastra/core': minor
---

feat(harness): v1 goal API (`Session.setGoal`/`getGoal`/`pauseGoal`/`resumeGoal`/`clearGoal`)

Adds standing-objective support to harness v1 sessions per §4.7. Goals are
attached via `session.setGoal({ objective, judgeModel?, maxTurns?, kickoff? })`
and evaluated by a judge model after every user-driven assistant turn.
Verdicts (`done` / `continue` / `waiting`) drive auto-continuation via the
session's durable queue so user follow-ups preempt cleanly. Budget exhaustion
(`turnsUsed >= maxTurns`) and judge failure both fall back to a paused state
with a typed reason. Goal-driven continuation turns are skipped by the judge
to prevent infinite loops. Subagent sessions reject `setGoal` — parents own
the loop.

New events: `goal_set`, `goal_judged`, `goal_done`, `goal_paused`,
`goal_resumed`, `goal_cleared`. New config: `HarnessConfig.goals`
(`defaultJudgeModel`, `defaultMaxTurns`). New types: `GoalOptions`.
