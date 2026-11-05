---
'@mastra/inngest': patch
---

Fixed agent stream events to use agent-scoped topics and prevent cross-agent interference for shared run IDs.

Requires `@mastra/core >=1.83.0-alpha.1 <2.0.0-0` for the shared agent transport helper. Finish/drain existing runs before upgrading core, server, and Inngest together; mixed versions cannot observe or abort each other's in-flight runs.
