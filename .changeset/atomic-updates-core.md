---
'@mastra/core': patch
---

Added `supportsConcurrentUpdates()` method to `WorkflowsStorage` base class and abstract `updateWorkflowResults`/`updateWorkflowState` methods for atomic workflow state updates. The evented workflow engine now checks `supportsConcurrentUpdates()` and throws a clear error if the storage backend does not support concurrent updates.
