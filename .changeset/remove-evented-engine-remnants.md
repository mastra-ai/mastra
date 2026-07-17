---
'@mastra/core': patch
---

Remove leftover branches that selected the evented workflow engine inside the regular `Agent` loop. The agentic-execution workflow now always uses the in-process workflow engine, and `Agent` no longer maintains an ephemeral `Mastra` (with its own pubsub and `startWorkers()` lifecycle) just to host the evented path. This removes a class of subtle behavior differences between the two engines from `Agent.stream()` / `Agent.generate()` and simplifies the suspend/resume scope lifecycle.

No public API changes. The evented workflow infrastructure itself is unchanged and continues to be used by background tasks, notifications, the score-traces workflow, and other subsystems that explicitly opt into it.
