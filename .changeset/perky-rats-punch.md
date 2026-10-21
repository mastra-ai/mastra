---
'@mastra/core': patch
---

Fixed resumed agent spans to remain children of the initial agent run across repeated suspensions, matching durable agent tracing.
