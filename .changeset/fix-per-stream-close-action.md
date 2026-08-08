---
"@mastra/core": patch
---

Fixed two concurrent `resumeStream()` (or `timeTravelStream()`) calls for the same run leaving one of the two streams open forever. Each call stored its close action on the run instance, so the second overwrote the first's: when the run completed it closed only the newest stream, and the earlier one never received `workflow-finish` and never reached EOF. Over HTTP that left the losing `/resume-stream` or `/time-travel-stream` request hanging until the client or proxy timed out. Each stream now closes through its own close action.
