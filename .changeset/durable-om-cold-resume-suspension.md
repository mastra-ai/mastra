---
'@mastra/core': patch
---

Restore the persisted delegation tool call on a cold durable-agent resume before updating suspension metadata. This keeps the next sub-agent suspension in memory when a replacement instance resumes with observational memory enabled.
