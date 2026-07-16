---
'@mastra/code-sdk': patch
---

Fixed ACP clients dropping standalone signal messages such as system reminders and notification summaries, while preserving assistant text deltas across interleaved signals without inserting separators.
