---
'@mastra/core': patch
---

Fixed `agent.stream()` skipping `onFinish` when an output processor blocks the stream with a tripwire. `onFinish` and the agent's finish handling (memory, title generation, scorers) now run once with `finishReason: 'other'` and the tripwire details. This also applies to tool-result tripwires on the default in-process loop; the durable, evented and Inngest engines still settle those without calling `onFinish`.
