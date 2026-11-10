---
'@mastra/core': patch
---

DurableAgent and EventedAgent run stream events now send only the response messages that changed since the previous step, instead of the whole list on every step, so long runs with large tool outputs keep their stream logs small. Steps that run on another worker continue from the run's saved state. Callers and `observe()` still report the full list for each step, including `observe()` from an offset when the pubsub keeps history.

Upgrade the processes that run durable agents and the ones that read their streams together: a reader on an older version reports no response messages for steps published by this version.
