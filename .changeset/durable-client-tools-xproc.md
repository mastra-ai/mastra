---
'@mastra/core': patch
---

Fixed call-time `clientTools` being dropped by durable agents (such as Inngest agents) when the workflow worker runs in a different process from the caller. Client tool schemas are now carried on the workflow input and restored when the worker rebuilds the run's tools, so the model can call them as expected.
