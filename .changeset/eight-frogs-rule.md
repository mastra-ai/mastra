---
'@mastra/core': patch
---

Refactored how assistant messages are constructed during streaming. Messages are now built from the complete chunk sequence after each step instead of being assembled mid-stream. This fixes duplicate OpenAI item IDs (`rs_*`, `msg_*`), eliminates empty text parts from streaming artifacts, and ensures provider metadata is correctly attributed.
