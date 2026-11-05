---
'@mastra/core': patch
---

Fixed cross-agent stream, abort, and replay cleanup interference when agents share a run ID. Upgrade core, server, and Inngest together; mixed versions cannot observe or abort each other's in-flight runs.
