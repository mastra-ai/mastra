---
'@mastra/core': patch
---

Deliver steering signals to a durable run whose steps execute in another process. The executing process follows the run's thread signals and drains them between steps, then publishes `signals-drained` so the process that started the run drops its copy and does not send it again as a follow-up run.
