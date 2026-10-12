---
'@mastra/core': patch
---

Fixed workflow step scorers silently not saving scores when the step runs inside a nested workflow that isn't registered on the Mastra instance. The scorer hook now falls back to the Mastra-registered scorer instead of failing with `MASTRA_SCORER_FAILED_TO_RUN_HOOK`. Fixes #26790.
