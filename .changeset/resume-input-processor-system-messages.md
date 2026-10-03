---
'@mastra/core': patch
---

Fixed resumed runs (for example after `approveToolCall`) dropping system messages added by input processors in `processInput`, including the task-list instruction from `TaskSignalProvider`. For processors whose system messages don't depend on conversation content, the resumed model call now sends the same system messages as the original run, which keeps provider prompt caches valid across approvals. System messages a processor derives from user or conversation messages are not reproduced on resume, because no conversation messages are available during the replay.

Behavior change: each input processor's `processInput` now runs once more on every resume, against a list containing only system messages. Make sure any side effects in `processInput` (logging, counters, storage writes, LLM calls) are safe to repeat.
