---
'@mastra/inngest': patch
---

Fixed agent stream events to use agent-scoped topics and prevent cross-agent interference for shared run IDs.

Requires `@mastra/core >=1.83.0-0 <2.0.0-0`. Upgrade core, server, and Inngest together; mixed versions cannot observe or abort each other's in-flight runs.
