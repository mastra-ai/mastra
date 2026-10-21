---
'@mastra/core': patch
---

Fixed evented agent worker takeover with Postgres by routing distributed orchestration through the shared broker and rejecting stale step deliveries. Persisted loop results, state, request context, and loop decisions survive redelivery without repeating completed iterations. Upgrade core and pg together and drain runs started on older versions before upgrading.
