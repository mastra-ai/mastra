---
'@mastra/core': patch
---

Fixed a bug where calling the same tool twice in parallel within a single assistant turn would only let you resume one of the two calls. The other call became orphaned and could never be resumed, even after a restart.

Each suspended tool call (and each pending approval) is now tracked separately, so all parallel calls to the same tool can be resumed independently. Runs that were persisted before this fix continue to resume correctly.

Fixes #16468.
