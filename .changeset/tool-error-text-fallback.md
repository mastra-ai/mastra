---
'@mastra/react': patch
---

A failed tool call whose error has no message now shows the error's name, or "The tool call failed.", instead of `[object Object]`. The error's `cause` is still never shown.
