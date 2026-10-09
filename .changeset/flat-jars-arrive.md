---
'@mastra/core': patch
---

Experimental durable and evented agents now restart a model request that has only produced reasoning when a new message or signal arrives, so the agent answers with the new input instead of finishing a stale response. This matches the default agent.

- The restarted request keeps the same step: it doesn't use up `maxSteps` or add token usage, and the discarded reasoning stays out of history.
- Input processors always finish; only the model request is cancelled.
- In traces, the cancelled request's step and inference spans end with finish reason `interrupted`.
