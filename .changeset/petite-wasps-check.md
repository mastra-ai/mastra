---
'@mastra/blaxel': patch
---

Removed `parseInt()` workaround for PIDs — Blaxel string PIDs are now used directly as `ProcessHandle.pid`, removing the separate `_identifier` field.
