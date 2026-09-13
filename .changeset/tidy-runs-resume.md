---
'@mastra/core': patch
---

Workflow and agent delegation tools no longer adopt a malformed `suspendedToolRunId`, such as the literal string `"null"` that some models emit on ordinary calls. A sentinel value is now treated as absent, so independent calls each get their own run instead of sharing one suspended run and silently dropping all but one result. Where the framework has already resolved the suspended run, that run is resumed even when the model supplied an unusable value. Fixes #23739.
