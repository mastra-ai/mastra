---
'@mastra/core': minor
---

Added `PubSub.trimTopic(topic, { runId })` (no-op by default). Once a thread run completes successfully and its messages are saved, Mastra deletes that run's entries from the thread topic, so retained backends no longer keep finished runs. Entries are matched by `runId`, so a run resumed after a server restart also clears what it published before the restart. Runs still in progress, waiting for approval, or owned by another process are never touched. Threads whose agent has no storage are not trimmed.

Long runs are also trimmed as they go: each time messages are saved mid-run (for example by Observational Memory at every step), the parts up to the last finished step are dropped from the topic via the new `producedBefore` option. Pending approval and suspension prompts stay until the run itself is trimmed.
