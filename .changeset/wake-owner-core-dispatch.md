---
'@mastra/core': patch
---

Fixed deferred notifications running with no request context when the agent's delivery policy throws at delivery time. The delivery attempt now fails with the policy's error and is retried up to the attempt limit, instead of falling back to a bare wake that runs without a user.

Fixed low-priority notification summaries failing to save when the agent's memory depends on who owns the thread. The summary is still saved without starting a run, but now carries the delivery policy's request context.
