---
'@mastra/core': patch
---

Fixed streamed assistant message assembly to prevent duplicate OpenAI item IDs (`rs_*` and `msg_*`). Also fixed empty text parts being saved from empty deltas, and ensured provider metadata is attached to the correct content part.
