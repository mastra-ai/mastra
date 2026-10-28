---
'@mastra/observability': minor
---

Model and agent spans now report `timeToFirstTokenMs`: the milliseconds from the start of the model call to its first streamed chunk. Unlike `timeToFirstChunkMs`, it leaves out the work Mastra does before calling the model, such as input processors.

Model inference spans measure from their own start. Model step, model generation and agent run spans measure from the start of their first model inference, which they carry in a new `inferenceStartTime` attribute. Spans that never streamed a chunk have no value.
