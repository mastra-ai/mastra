---
'@mastra/core': patch
---

Fixed system messages added by input processors (such as the task-list instruction from `TaskSignalProvider`) going missing after a tool approval resume on the plain `Agent`. The resumed request now sends the same system prompt as the original, so the model keeps its context and provider prompt caching is not invalidated. Fixes #24844.
