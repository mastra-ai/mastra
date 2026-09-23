---
'@mastra/core': minor
---

Added `PubSub.trimTopic(topic, entryIds)` (no-op by default); `PubSub.publish` may now resolve to the published entry ID. Mastra records the entry IDs each thread run publishes and deletes exactly those once the run completes successfully and its messages are saved, so retained backends no longer keep finished runs. Runs still in progress, waiting for approval, or owned by another process are never touched. Threads whose agent has no storage are not trimmed.
