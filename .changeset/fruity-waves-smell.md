---
'@mastra/inngest': patch
---

Fixed resuming a workflow run that is not suspended. Resuming a finished or in-flight run now fails fast with a clear error instead of overwriting its saved result or error and dispatching a duplicate resume event. Fixes #31595
