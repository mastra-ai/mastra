---
'@mastra/inngest': minor
---

Added a `shouldPersistSnapshot` option to `createInngestAgent()` for API symmetry with `createDurableAgent()`. InngestAgent logs a warning and ignores it: Inngest's step memoization and replay own durability, so Mastra snapshots are only persisted for `suspended` runs (human-in-the-loop resume).
