---
'@mastra/core': minor
---

Added MASTRA_OFFLINE environment variable to disable network fetches for provider data in offline/air-gapped environments. When set to 'true' or '1', all provider sync and auto-refresh operations are skipped while the static provider registry remains fully functional.
