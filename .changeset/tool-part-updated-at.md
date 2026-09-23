---
'@mastra/core': patch
---

Tool invocation parts now record `updatedAt` whenever their state changes (approval response, result, error), and `tool-call-approval` chunks carry the matching `updatedAt`. Thread subscribers can use it to tell whether a streamed part is newer than stored history.
