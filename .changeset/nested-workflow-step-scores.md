---
'@mastra/core': patch
---

Fixed workflow step scorers silently not saving scores when the step runs inside a nested workflow that isn't registered on the Mastra instance. The scorer hook now falls back to the Mastra-registered scorer instead of failing with `MASTRA_SCORER_FAILED_TO_RUN_HOOK`. Fixes #26790.

`mastra.getScorerById()` now prefers a scorer whose `id` matches exactly before falling back to a `name` match, so a scorer whose name equals another scorer's ID can no longer be returned in its place.
