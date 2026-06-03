---
'@mastra/core': patch
---

Fix `resolveStateSignalHistory` clobbering the storage-derived `contextWindow.hasSnapshot` with the stale in-prompt value. When the in-prompt window contained no `role:'signal'` rows (observational memory, aggressive context trimming, or any window strategy that drops raw signal rows), the storage fallback correctly found the prior snapshot via `tracking.lastSnapshotSignalId` but the final return statement overrode `contextWindow` with the stale local value, leaving `hasSnapshot=false`. Downstream consumers (e.g. `WorkingMemoryStateProcessor`) saw `shouldRefreshSnapshot=true` and re-emitted full snapshots on every turn instead of unified-diff deltas.
