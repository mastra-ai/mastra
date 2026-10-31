---
'@mastra/core': patch
---

Retries in `fetchWithRetry` now wait through the shared retry delay helper. Retry timing and abort behaviour are unchanged.
