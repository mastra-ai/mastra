---
'@mastra/memory': patch
---

Fixed disabling Observational Memory for a single call. Previously, passing `observationalMemory: false` for one request had no effect when Observational Memory was already enabled on the Memory instance — it stayed active. This per-request override is now respected correctly.
