---
'@mastra/observability': minor
---

Model tracing now records `completionStartTime` on the model's first response chunk of any kind, including a non-streamed tool call, and copies it onto the model step, model generation and the agent's own run span. Time to first chunk can be derived on every level as `completionStartTime - startTime`.
