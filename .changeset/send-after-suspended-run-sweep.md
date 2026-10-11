---
'@mastra/core': patch
---

Fixed messages sent to a thread right after its suspended run was evicted by the suspended-run TTL being reported as delivered and then lost. The send now waits for the evicted run's thread lease to expire and starts a new run with the message. A run resumed on another instance still receives the message as before.
