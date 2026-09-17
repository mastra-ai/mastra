---
'@mastra/core': patch
---

Stopped durable agent runs from waiting for thread title generation before they finish. The title is now generated in the background, the same way `Agent.generate()` and `Agent.stream()` already do it, so the first turn of a new thread no longer ends seconds after its answer was written.
