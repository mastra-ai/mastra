---
'@mastra/core': patch
'mastracode': patch
---

Unified model selection around packs and fixed model ranking/persistence behavior in mastracode.

- Added `modelUseCountTracker` to harness config and wired it from mastracode so selecting a model now increments persisted `modelUseCounts`, restoring usage-based model sorting.
- Added thread-aware active mode-pack resolution helpers and persisted `activeModelPackId` in thread metadata so pack selection restores per thread.
- Updated `/models` to be the single pack command path and removed `/models:pack` from user-facing surfaces.
- Expanded custom pack management to support named custom packs with create/edit/delete flows and persisted updates in settings.
- Updated onboarding + README text to align with pack-first model management.
