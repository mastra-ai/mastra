---
'@mastra/core': patch
---

Fixed recovered durable agent runs going silent for thread subscribers. Two problems combined to cause this:

- `recoverActiveRuns()` no longer cleans up a run that pauses for tool approval during recovery. The run stays registered, so you can approve it and subscribers see it finish.
- Thread subscribers now receive a recovered run's events when using a shared pubsub such as Redis. Previously the crashed process's unfinished stream kept the subscriber waiting, so it never saw the recovered run's approval request or result.
