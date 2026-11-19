---
'@mastra/core': patch
---

Fixed notifications being recorded as delivered when the target thread could not accept the signal. A blocked delivery now stays pending and eligible for retry instead of being silently dropped. Retries depend on notification dispatch being enabled, and a record is marked `failed` once it reaches the delivery attempt limit.
