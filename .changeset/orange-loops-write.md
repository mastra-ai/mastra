---
'@mastra/core': patch
---

Fixed notifications that failed on their first delivery attempt. Delivery now retries automatically, up to five attempts, instead of staying pending forever. A signal that requires a claimed thread owner still reaches that owner on retry.
