---
'@mastra/core': patch
---

Fixed channel replies failing with `render.wrapStream is not a function` when an agent run was restored from a persisted snapshot, such as a durable run or a resumed workflow. Channel replies now render on those runs as they do on live ones.
