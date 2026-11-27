---
'@mastra/core': patch
---

Fixed output stream processor spans in runs with `structuredOutput` and a separate `model`. When a custom data chunk was written before the first model step, the processor span was missing and the structuring model call moved to a trace of its own. In a run with a tool call, the processor span ended after the first model step. In both cases the structuring model's token usage was lost from the trace.
