---
'@mastra/playground-ui': patch
---

Improved grouped tool-call summaries with successful, failed, and incomplete counts. Calls without a recorded result are not counted as successful when a run stops. Existing consumers that omit outcome information retain their previous summaries.
