---
'@mastra/core': patch
---

Fixed supervisor-specialist workflow suspend/resume breaking when sub-agent gets a fresh thread ID on every delegation. The sub-agent thread and resource IDs are now preserved in suspension metadata and reused on resume, so workflows resume from the suspended step instead of restarting from scratch. Fixes #15734.
