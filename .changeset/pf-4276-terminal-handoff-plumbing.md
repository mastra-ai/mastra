---
'@mastra/pg': patch
---

`PostgresStore` now forwards the `terminalHandoff` option to the Harness domain, so `maxSeedBytes`, `maxPayloadBytes`, `maxAttempts`, `maxPendingIntents`, `maxPendingBytes`, and `claimLeaseMs` bounds configured at the store level reach the adapter. Previously the option was accepted by `HarnessPG` but silently dropped by `PostgresStore` config plumbing.
