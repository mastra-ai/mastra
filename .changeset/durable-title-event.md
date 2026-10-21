---
'@mastra/core': patch
---

Fixed durable and evented agents ignoring `generateTitle.emitEvent` and `onTitleGenerated`. Streams from these agents now include the transient `data-thread-title` chunk before `finish`, and `memory.onTitleGenerated` is called with the saved title, matching the standard agent.
