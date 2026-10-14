---
'@mastra/observability': patch
---

Model tracing now records `completionStartTime` on the first chunk of any provider type, including a non-streamed tool call, and copies it onto the model step, model generation and the agent's own run span. Time to first chunk can be derived on every level as `completionStartTime - startTime`.
