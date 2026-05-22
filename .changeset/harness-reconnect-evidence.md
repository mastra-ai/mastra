---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Add Harness v1 inbox-response result lookup evidence for reconnect recovery, expose the route in generated client route types, emit a once-per-session event when workspace action journaling is unavailable, and harden Harness SSE replay with bounded replay/live dedupe plus page keepalives.
