---
'@mastra/memory': patch
---

Changed the default recall scope for Observational Memory from resource to thread. This prevents unintended data leakage between users when no explicit scope is configured.
