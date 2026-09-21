---
'@mastra/core': patch
'@mastra/pg': patch
---

Fixed the in-memory Harness terminal-handoff claim scan to reclaim intents whose claim lease expired. Previously an intent stuck in `claimed` status past its lease was never re-delivered, diverging from the Postgres adapter which reclaims expired claims.

`PostgresStore` now forwards the `terminalHandoff` option to the Harness domain, so `maxSeedBytes`, `maxPayloadBytes`, `maxAttempts`, `maxPendingIntents`, `maxPendingBytes`, and `claimLeaseMs` bounds configured at the store level reach the adapter. Previously the option was accepted by `HarnessPG` but silently dropped by `PostgresStore` config plumbing.
