---
'@mastra/core': patch
---

Fixed evented agent runs that never finished while the lease backend (for example Redis) was unreachable and hung. Each evented step now waits at most 5 seconds for its duplicate-delivery fence. After that, the step runs as it already did when the backend returned an error. A run that lost its thread lease now ends as `aborted` instead of hanging.
