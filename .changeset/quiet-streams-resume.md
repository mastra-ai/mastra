---
"@mastra/core": patch
---

Fixed steering a conversation getting stuck after a canceled response stops arriving. Late approval results can no longer interrupt the next response, and pending end hooks finalize a run only once.
