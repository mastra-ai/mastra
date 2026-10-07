---
'@mastra/core': patch
---

Fixed Inngest durable agents saving messages to memory on turns where memory is set to `readOnly: true`. The run's memory settings now carry over to the step that finishes the run, so read-only turns no longer write to the thread. Fixes [#26147](https://github.com/mastra-ai/mastra/issues/26147).
