---
'@mastra/core': patch
---

Fixed cross-agent stream, abort, and replay cleanup interference when agents share a run ID. Upgrade core, server, and Inngest together; active stream topics from older versions are not replayed.
