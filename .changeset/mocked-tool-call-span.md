---
'@mastra/core': patch
---

Record a `tool_call` span for tool calls served by experiment `toolMocks`. The span carries the mocked output and the attribute `mocked: true`, so experiment traces show mocked calls next to model steps instead of only inside the model step output.
