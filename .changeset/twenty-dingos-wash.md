---
'@mastra/server': patch
---

Fixed suspended tool responses timing out while the resumed agent run continues. The endpoint now acknowledges immediately, preventing spurious 504 responses and delayed response-body errors for long-running continuations.
