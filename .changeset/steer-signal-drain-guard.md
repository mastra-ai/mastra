---
'@mastra/core': patch
---

Queued mid-run user messages are no longer silently lost when a run fails. Two fixes: a stream that dies on a provider error now settles its completion watcher (the error path emits the finish event like the completion path does), so run cleanup, signal draining, and lease release all still happen; and if starting the follow-up run for a queued message throws, the message is restored to the head of the queue, the failure is published as the existing run failed event so it renders as an error, and the message delivers on the next turn.
