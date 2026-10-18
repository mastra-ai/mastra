---
'@mastra/core': patch
---

Fixed missing token usage when a tool call suspends or waits for approval. Suspended `stream()` and `generate()` results now include the step's tokens. After resuming, `totalUsage` stays cumulative and token metrics count those tokens once. See #27232.
