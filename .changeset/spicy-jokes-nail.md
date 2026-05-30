---
'@mastra/evals': patch
---

Fixed `extractToolCalls` and `extractToolResults` in `@mastra/evals` to also read tool invocations from V2 `content.parts` when `toolInvocations` is absent. Previously both functions only checked `message.content.toolInvocations`, which missed tool calls stored in `content.parts` as `tool-invocation` parts — the format used when observable memory is enabled. This caused hallucination and tool-usage scorers to receive empty tool data, producing incorrect scores.
