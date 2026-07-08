---
'@mastra/react': patch
---

Fixed Studio chat live streaming so text on either side of an interruption no longer merges into one block. When an agent interleaves text with a tool call or a reasoning step and then continues with more text, the messages now render in the correct order while streaming, matching what you see after a page refresh.
