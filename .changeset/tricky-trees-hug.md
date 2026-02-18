---
'@mastra/core': patch
---

Fixed CompositeAuth losing public and protected route configurations from underlying auth providers. Routes marked as public or protected now work correctly when deployed to Mastra Cloud.
