---
'@mastra/core': patch
---

Fixed stale tool suspension metadata when resuming with `agent.resumeStream()`.

A tool suspended with `suspendSchema` left its `suspendedTools` entry on the saved assistant message after it was resumed via `agent.resumeStream(resumeData, { runId, toolCallId })`. A client reloading the thread read the already-resolved tool as still waiting for input, and could send the next resume to the wrong tool call. The entry is now cleared for both resume paths.

Fixes Bug B of [#19083](https://github.com/mastra-ai/mastra/issues/19083).
