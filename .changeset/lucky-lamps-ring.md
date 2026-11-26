---
'@mastra/core': patch
---

Fixed approved tools in durable agents running with the starting caller's request context when another server resumed the run. A resumed run now rebuilds its tools for the caller who resumed it, and no longer keeps tools the resuming caller isn't given. A resume whose tools can't be rebuilt now fails instead of running the earlier caller's tools.
