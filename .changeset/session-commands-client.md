---
'@mastra/client-js': minor
---

Agent controller sessions can clear state keys atomically with `setState(updates, { unset })`, and start goals immediately with `setGoal(objective, { trigger: true })` or `updateGoal({ status, trigger: true })`. A triggered goal that cannot start is persisted as paused and reported through a 502.
