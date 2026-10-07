---
'@mastra/memory': patch
---

Fixed Observational Memory recording completed background-task tool results as `null`. A `null` stored model output now falls back to the actual tool result, matching how `@mastra/core` replays tool results, so the Observer, token counting, and recall see the real result.
