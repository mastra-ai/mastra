---
'@mastra/core': patch
'mastracode': patch
---

Suppressed noisy gateway fetch errors when models.dev is unreachable. The registry no longer retries or logs errors on network failure since all model data is already bundled at publish time.
