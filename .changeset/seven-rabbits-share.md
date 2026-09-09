---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Added an optional `includeTotal` flag to the message listing storage input. It defaults to `true` so existing pagination keeps working. Internal last-N memory reads now set it to `false` to skip counting all matching messages when only the recent window is needed.
