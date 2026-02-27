---
"@mastra/memory": patch
---

Fix stale observational-memory continuation hints by explicitly clearing thread OM metadata when newer observation/activation results omit `<current-task>` or `<suggested-response>`.

This updates observation and activation metadata writes to always set `currentTask` and `suggestedResponse` (including `undefined`), preventing previously stored hints from being re-injected into context after they are no longer present in the latest model output.