---
'@mastra/inngest': patch
---

Internal refactor: the Inngest durable agent's `observe()` now uses `@mastra/core`'s shared `detachFullStreamOnEnd` helper instead of its own copy of the `fullStream` detach wrapper. No behavior change.
