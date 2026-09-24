---
'@mastra/inngest': patch
---

Fixed failing steps in Inngest workflows running extra times when `retries` is set. Inngest applied `retries` to every failing step on top of the step's own retries, so a step with no retries ran three times with `retries: 2`. Errors marked non-retryable were retried too. Failing steps now only use their own retry settings. `retries` still re-runs a workflow when a request to your app fails, such as during a process restart.
