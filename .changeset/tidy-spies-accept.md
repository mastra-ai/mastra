---
'@mastra/core': patch
---

Added the saved view schemas (`savedViewStateSchema`, `savedViewStateEnvelopeSchema`, `SAVED_VIEW_STATE_MAX_BYTES` and related types) to the browser-safe `@mastra/core/storage/dashboards` entry, so browser apps can validate a saved view before sending it.
