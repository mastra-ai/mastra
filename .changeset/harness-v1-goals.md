---
'@mastra/core': minor
---

Added the Harness v1 goal API for standing session objectives.

Sessions can now attach a goal, inspect it, pause or resume it, and clear it.
After each user-driven assistant turn, a judge model evaluates whether the goal
is done, should continue, or is waiting on the user. Continuation turns use the
durable queue so user follow-ups can preempt cleanly.

```ts
await session.setGoal({
  objective: 'Prepare a migration checklist for the open PRs',
  judgeModel: 'openai:gpt-4.1',
  maxTurns: 12,
  kickoff: true,
});

const goal = await session.getGoal();
await session.pauseGoal({ reason: 'waiting_on_user' });
await session.resumeGoal();
```

Budget exhaustion and judge failures pause the goal with typed reasons. Goal
continuation turns are skipped by the judge to prevent loops, and subagent
sessions reject `setGoal(...)` because the parent owns the loop.

New events: `goal_set`, `goal_judged`, `goal_done`, `goal_paused`,
`goal_resumed`, `goal_cleared`. New config: `HarnessConfig.goals`
(`defaultJudgeModel`, `defaultMaxTurns`). New type: `GoalOptions`.
