---
'@mastra/e2b': minor
---

Raised the `@mastra/core` peer dependency floor to `>=1.55.0-0`. The previous floor (`>=1.12.0-0`) was stale: `E2BCodeModeTransport` already relies on Code Mode runtime exports that only exist in much newer cores, so older pairings crashed at import time. `E2BCodeModeTransport` now also reuses the `sanitizeToolId` helper exported from `@mastra/core/tools` for `external_*` naming instead of a local copy, guaranteeing it stays identical to the names in the generated stubs.
