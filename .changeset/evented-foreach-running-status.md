---
'@mastra/core': patch
---

Fixed the evented workflow engine reporting a `foreach` step as `success` while its iterations were still running. The stored step now stays `running` (no `endedAt`) until every iteration finishes, and `getWorkflowRunById` no longer shows unfinished iterations as `null` entries in the step output, matching the default engine.
