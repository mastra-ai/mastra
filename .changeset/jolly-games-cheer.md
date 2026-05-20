---
"@mastra/memory": patch
---

feat(memory): start background buffering of unobserved messages when agent goes idle

In OM buffering mode, when the agent goes idle (turn.end()), any unobserved messages are now buffered in the background via a fire-and-forget buffer() call. This ensures observations are computed proactively rather than waiting for the next turn's step.prepare().
