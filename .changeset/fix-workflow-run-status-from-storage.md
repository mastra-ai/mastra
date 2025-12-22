---
'@mastra/core': patch
---

When createRun is called with an existing runId, it now correctly updates the run's status from the storage snapshot. This fixes the issue where different workflow instances (e.g., different API requests) would get a run with 'pending' status instead of the correct status from storage (e.g., 'suspended').

