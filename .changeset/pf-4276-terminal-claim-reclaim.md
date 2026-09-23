---
'@mastra/core': patch
---

Fixed the in-memory Harness terminal-handoff claim scan to reclaim intents whose claim lease expired. Previously an intent stuck in `claimed` status past its lease was never re-delivered, diverging from the Postgres adapter which reclaims expired claims.
