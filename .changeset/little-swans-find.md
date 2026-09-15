---
'mastra': patch
---

Fixed mastra dev and mastra build crashing with an "Invalid Version" error when an installed @mastra package version could not be resolved. Unresolved workspace:, catalog:, or range specifiers are now skipped by the peer dependency check (#23302).
