---
'@mastra/core': minor
---

Added `PubSub.trimTopic(topic, { runId })` (no-op by default). Once a thread run completes successfully and its messages are saved, Mastra deletes that run's entries from the thread topic, so retained backends no longer keep finished runs. Entries are matched by `runId`, so a run resumed after a server restart also clears what it published before the restart. Runs still in progress, waiting for approval, or owned by another process are never touched. Threads whose agent has no storage are not trimmed.
