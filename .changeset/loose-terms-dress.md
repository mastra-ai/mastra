---
'@mastra/core': patch
---

Fixed stale tool suspension metadata when resuming with `agent.resumeStream()`.

A tool suspended with `suspendSchema` left its `suspendedTools` entry on the saved assistant message after it was resumed via `agent.resumeStream(resumeData, { runId, toolCallId })`. A client reloading the thread read the already-resolved tool as still waiting for input, and could send the next resume to the wrong tool call. The entry is now cleared for both resume conventions.

**Falsy resume payloads are handled correctly**

A tool whose `resumeSchema` is a primitive can legitimately be resumed with `false`, `0` or `""`, which is how a boolean human-in-the-loop tool declines. Those payloads now clear the suspension entry, and a delegated `agent-*` or `workflow-*` tool resumed with one keeps resuming its existing sub-run instead of silently starting a fresh one.

**Approval resumes no longer disturb sibling suspensions**

On an approve-after-policy-loss resume the approval branch already clears its own metadata, so the generic suspension cleanup is skipped there. Previously it could run on top and remove the entry of a different, still-suspended call of the same tool.

Fixes [#19083](https://github.com/mastra-ai/mastra/issues/19083).
