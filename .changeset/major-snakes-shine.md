---
'@mastra/inngest': minor
---

Added execution outcomes and stop-reason details to Inngest agent and workflow traces. Separate resumed-segment tracing and termination-cause preservation across workers are not yet supported; missing causes can produce `unknown` outcomes.
