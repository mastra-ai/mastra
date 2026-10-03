---
'@mastra/core': patch
---

Fixed agent step callbacks returning empty content and tool results when observational memory reorganizes multi-turn messages.

When a background task completes and its tool result is replaced in place, a later step's `content` and `toolResults` now include that earlier `toolCallId` with the completed result. `StepResult` consumers (for example `stopWhen` and `onStepFinish`) can observe this.
