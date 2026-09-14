---
'@mastra/core': patch
---

Fixed agent runs failing when a tool's `toModelOutput` mapping threw an error. Mapping failures are now non-fatal: a warning is logged and the raw tool result is committed and streamed instead of erroring the whole request.
