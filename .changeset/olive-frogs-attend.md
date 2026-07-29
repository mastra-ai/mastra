---
'@mastra/e2b': patch
---

`E2BCodeModeTransport` now reuses the `sanitizeToolId` helper exported from `@mastra/core/tools` for `external_*` naming instead of a local copy, guaranteeing it stays identical to the names in the generated stubs. No behavior change.
