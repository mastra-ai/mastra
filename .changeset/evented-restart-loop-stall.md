---
'@mastra/core': patch
---

Fixed evented durable agent runs that hung forever after the API and worker restarted together mid-tool. The recovered run now finishes and releases its thread, so the next run on that thread is no longer rejected with `AgentThreadLeaseConflictError`.
