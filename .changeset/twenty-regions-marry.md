---
'@mastra/core': patch
---

Fixed durable agents (`createDurableAgent`) silently dropping stored working memory from the prompt. Working memory was saved correctly but never injected back, so per-request preferences had no effect on output. Durable preparation now establishes the memory context before resolving input processors so the working-memory injector is included.
