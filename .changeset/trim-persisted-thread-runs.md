---
'@mastra/core': minor
---

Added `PubSub.trimTopic(topic, { runId })` (no-op by default). Once a thread run completes successfully and its messages are saved, Mastra deletes that run's entries from the thread topic, so retained backends no longer keep finished runs. Entries are matched by `runId`, so a run resumed after a server restart also clears what it published before the restart. Runs still in progress, waiting for approval, or owned by another process are never touched. Threads whose agent has no storage are not trimmed.

Long runs are also trimmed as they go: each time messages are saved mid-run (by Observational Memory, or by `savePerStep` on `Agent` and `DurableAgent`), the parts up to the last finished step are dropped from the topic via the new `producedBefore` option. Pending approval and suspension prompts stay until the run itself is trimmed.

Runs that fail, are canceled, or never start (for example a woken idle thread with no usable model credential) are deleted from the topic 30 seconds after they end. Nothing from them was saved, so reconnecting subscribers already ignore them; the delay lets subscribers reading live still see the failure.
