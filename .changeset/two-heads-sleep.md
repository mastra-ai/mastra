---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable, evented, and Inngest agents leaking one-step prepareStep system message overrides into later model steps.
