---
'@mastra/core': patch
---

Fixed resumed runs (for example after `approveToolCall`) dropping system messages added by input processors in `processInput`, including the task-list instruction from `TaskSignalProvider`. The resumed model call now sends the same system messages as the original run, which also keeps provider prompt caches valid across approvals. Resuming still does not re-run input processors on your conversation messages.
