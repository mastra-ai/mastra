---
'@mastra/core': patch
---

Fixed notifications that failed on their first delivery attempt. Delivery now retries automatically, up to five attempts, instead of staying pending forever. Retries preserve the claimed-owner requirement.
