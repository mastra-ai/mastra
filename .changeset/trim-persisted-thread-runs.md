---
'@mastra/core': minor
---

Added `PubSub.trimTopic(topic, { before? })` (no-op by default). Once a thread run finishes and its messages are saved, the thread topic is cleared when the thread is idle, or trimmed up to the oldest run still in progress or waiting for approval, so retained backends no longer keep finished runs. Threads whose agent has no storage are not trimmed.
