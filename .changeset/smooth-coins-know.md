---
'@mastra/react': patch
---

Fixed Studio chat live streaming so text that comes before and after a tool call no longer merges into one block. When an agent interleaves text, a tool call, then more text, the messages now render in the correct order while streaming, matching what you see after a page refresh.
