---
'@mastra/core': patch
---

Fixed the evented workflow engine dropping the `suspend()` payload and resume labels when a step inside a nested workflow's `.branch()` or `.parallel()` suspends. With two suspended steps in a nested `.parallel()`, resuming one now leaves the parent pointing at the step that is still suspended, so the next resume no longer overwrites the earlier answer.
