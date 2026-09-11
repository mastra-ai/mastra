---
'@mastra/core': patch
---

Fix AgentController Session turning missing/unknown token counts into false zeros. Step-finish now skips fabricating, persisting, and emitting a usage update when a step reports no usable primary counts (prompt/completion/total all absent), instead of folding a `{0,0,0}` tally into the running total. `loadMetadata()` no longer calls `resetTokenUsage()` when a persisted metadata read fails transiently, so a measured tally is preserved instead of being destroyed by a read error. Fixes #23471.
