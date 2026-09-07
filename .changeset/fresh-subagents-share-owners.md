---
'@mastra/core': patch
---

Clean up background tasks whose initial dispatch is rejected: mark still-pending tasks failed, discard their invocation context, and free local capacity for queued work. Preserve tasks already claimed by a worker when a transport reports an ambiguous publication failure. Add regression coverage for async dynamic subagent selection across independent Mastra instances sharing storage with `recoverStaleTasksOnStart: false`, and for resume publication failures.
