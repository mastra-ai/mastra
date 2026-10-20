---
'@mastra/core': patch
---

Fixed deferred notifications running with no request context when the agent's delivery policy throws at delivery time. The delivery attempt now fails with the policy's error and is retried up to the attempt limit, instead of falling back to a bare wake that runs without a user.
