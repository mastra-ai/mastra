---
'@mastra/core': patch
---

Fixed resumed step retries and `perStep` runs on the evented engine. A resumed step that fails and is retried now gets the same resume data on its retry, so it finishes instead of suspending again. A run started with `perStep: true` now pauses after a step that succeeded on a retry, and after a loop, instead of running the remaining steps.
