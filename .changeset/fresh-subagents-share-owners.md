---
'@mastra/core': patch
---

Fixed background tasks whose initial dispatch is rejected by marking still-pending tasks as failed and freeing local capacity for queued work. Tasks already claimed by a worker are preserved when a transport reports an ambiguous publication failure.
