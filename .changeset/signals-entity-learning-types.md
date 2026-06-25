---
'@mastra/playground-ui': patch
---

Signals studio domain now consumes the real Entity Learning API response types as its source of truth. Replaced the static signals data/types with `/entity-learning/*` response shapes, added React Query hooks that fetch directly from the Mastra platform endpoint, and rewrote the overview and details pages to read the real fields with skeleton loading and explicit error states.
