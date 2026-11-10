---
'@mastra/inngest': patch
---

The Inngest durable agent's run stream events now send only the response messages that changed since the previous step, instead of the whole list on every step, so long runs keep their stream logs small. Callers and `observe()` still report the full list for each step, including after a resume or from an offset when the pubsub keeps history.

Upgrade the processes that run Inngest durable agents and the ones that read their streams together: a reader on an older `@mastra/core` reports no response messages for steps published by this version.
