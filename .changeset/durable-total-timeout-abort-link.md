---
'@mastra/core': patch
---

Fixed `DurableAgent` `abort()` not stopping in-flight tool or model calls when `modelSettings.timeout.totalMs` is set and the run's registry entry had been evicted under heavy concurrency.
