---
'@mastra/core': minor
---

Added Harness v1 lease heartbeat recovery and explicit lease extension support.

Live Harness sessions now renew their storage leases in the background, fail closed when ownership is lost, and expose `Session.extendLease()` / `Session.withExtendedLease()` for long-running work.
