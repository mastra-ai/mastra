---
'@mastra/core': patch
---

Fixed durable agent resumes approved from another server running with the original caller's request context and user. The resumed run now uses the context of the caller who resumed it.
