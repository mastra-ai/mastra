---
'@mastra/core': patch
---

Fixed `listSuspendedRuns()` reporting `toolCallId: undefined` for tool calls parked via `suspend()`. The id was only stored as the workflow resume label, so discovery dropped it and `sendToolApproval({ toolCallId })` could never match the run once it had to be resolved from storage. The suspend payload now carries the id (agentic and durable loops), and discovery recovers it from resume labels for snapshots persisted before this change.
