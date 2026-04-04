---
'@mastra/core': patch
---

Fixed crash in v4 stream transform when `step-start` chunks arrive with a missing or malformed request body, and when `step-finish` chunks have no messages property. The request body `JSON.parse` is now guarded with try-catch, and messages access uses optional chaining consistent with the existing `finish` handler in the same file.
