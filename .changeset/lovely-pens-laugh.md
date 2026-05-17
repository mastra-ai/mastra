---
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed Harness v1 deletion so deleting a closed session tree no longer leaves partial rows or cleanup data behind. Custom Harness storage adapters keep the legacy single-delete fallback, but should override `deleteSessions` to make multi-session deletes fully consistent.
