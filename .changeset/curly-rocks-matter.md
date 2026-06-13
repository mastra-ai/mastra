---
'@mastra/core': patch
---

Fixed `run.cancel()` not interrupting `sleep()` / `sleepUntil()` in the default workflow execution engine. The pending `setTimeout` was previously held until it fired naturally, which kept the run in memory for the full sleep duration, then flipped its status from 'canceled' back to 'running' and recorded the sleep step as 'success'. The sleep primitives now observe the run's abort signal: when `cancel()` is called the timer is cleared, the run settles as 'canceled' immediately, and the next step does not execute (closes #17908).
