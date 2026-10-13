---
'@mastra/factory': patch
---

Fixed in-memory Factory storage reusing another repository's session when creating a session for the same user and branch, matching database storage, which rejects the conflict.
