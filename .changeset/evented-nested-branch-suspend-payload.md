---
'@mastra/core': patch
---

Fixed the evented workflow engine dropping the `suspend()` payload and resume labels when a step inside a nested workflow's `.branch()` or `.parallel()` suspends. With two suspended steps in a nested `.parallel()`, resuming one now leaves the parent pointing at the step that is still suspended, so the next resume no longer overwrites the earlier answer.

Resuming the parent run by a label raised inside a nested workflow now resumes the step that owns that label, instead of whichever suspended step the nested run found first.
