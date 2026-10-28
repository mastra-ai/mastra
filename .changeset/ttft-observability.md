---
'@mastra/observability': minor
---

Model and agent spans now report `timeToFirstTokenMs`: the milliseconds from the start of the model call to its first streamed chunk. Unlike `timeToFirstChunkMs`, it leaves out the work Mastra does before calling the model, such as input processors.

The value is measured once on the model inference span that streamed the chunk, and model step, model generation and agent run spans carry the value of the nearest such inference below them, as a `timeToFirstTokenMs` attribute. Spans that never streamed a chunk have no value. A fallback model attempt now opens its own model inference span, named after the model it calls, so its value and label are its own. When an in-process agent retries a failed model call, the retry happens inside one inference span, so the value includes the failed attempt and the retry wait.
