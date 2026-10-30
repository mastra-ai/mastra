---
'@mastra/core': patch
---

Fixed durable runs stopping when a lease renewal queued behind other storage writes still belongs to the same execution. The run now waits up to one lease TTL past its deadline for the renewal result, then stops as before if the renewal has still not returned.
