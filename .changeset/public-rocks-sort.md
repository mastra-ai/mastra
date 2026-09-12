---
'@mastra/core': patch
---

Fixed persisted task lists missing from `session.displayState.get().tasks` after restarting a controller or reopening a thread. Task loading is best-effort and preserves existing metadata-error behavior.
