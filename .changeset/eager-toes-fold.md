---
'@mastra/core': patch
---

Fixed agent signal delivery errors being cut off at the resource id. Messages such as "No claimed thread owner responded" now name the thread and resource in full, so the whole error is stored and shown.
