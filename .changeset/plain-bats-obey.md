---
'@mastra/core': patch
---

Fixed the SystemPromptScrubber missing system prompts that are split across streaming chunks. Streamed text is now buffered and scanned together, so a system prompt no longer reaches the user just because it straddled a chunk boundary.
