---
'@mastra/stagehand': minor
---

Added automatic cleanup on browser close: patches `exit_type` to prevent restore dialogs, kills orphaned Chrome child processes, and uses CDP events for reliable disconnect detection in both shared and thread scope.
