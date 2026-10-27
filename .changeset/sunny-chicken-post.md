---
'@mastra/react': patch
---

Added an optional `scope` argument to `useTraceColumnPreferencesStorageKey` so traces and spans can save their column choices under separate keys. Existing traces column choices are kept.
