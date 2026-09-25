---
'@mastra/core': patch
---

Fixed agent runs with `readOnly` memory still persisting their transcript when a background tool task completed. The background-result flush now honors the readOnly contract the same way the suspension flush already did.
