---
'@mastra/core': patch
---

Fixed recovery of ToolSearchProcessor-loaded tools after a crash in an evented agent, with either `in-memory` or `context` storage. Recovery now reads the transcript from the active iteration's run, so the interrupted tool call resumes with its original ID instead of failing with `Tool not found`. Fixes https://github.com/mastra-ai/mastra/issues/28171.
