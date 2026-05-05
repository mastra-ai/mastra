---
'@mastra/server': patch
---

Fix a startup crash in `@mastra/server` when paired with an older `@mastra/core` (e.g. `1.31.0`) that does not export newer 1.32 names.

The server now starts successfully on those versions. Endpoints that depend on 1.32-only functionality degrade at request time instead of failing at module load.
