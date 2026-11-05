---
'@mastra/server': patch
---

Fixed remote agent observation and abort requests to target the owning agent when run IDs are reused across agents.

Requires `@mastra/core >=1.83.0-0 <2.0.0-0`. Upgrade core, server, and Inngest together; mixed versions cannot observe or abort each other's in-flight runs.
