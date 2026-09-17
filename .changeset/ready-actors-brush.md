---
'@mastra/inngest': patch
---

Fixed processor steps created with the Inngest adapter's createStep losing their saved state between calls. Processor state written in one phase (for example processInput) is now visible in later phases and in chained processor steps, matching the behavior of steps created with @mastra/core/workflows. Fixes [#23671](https://github.com/mastra-ai/mastra/issues/23671).
