---
'@mastra/core': minor
---

Thread subscriptions now publish a pending user-message chunk when a steer is accepted, so subscribers can present the message before the agent reads it.

Queued follow-ups publish queued user-message chunks when accepted and `data-user-message-cancelled` chunks when cancelled.
