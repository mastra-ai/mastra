---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed traces of durable agent runs that fail. The run and its model spans now end with the error instead of staying open as if the run was still in progress. This covers `createDurableAgent`, `createEventedAgent`, `createInngestAgent` and native durable engines, including when separate workers run the steps. Output stream processor spans on a worker now end with their model step.
