---
'@mastra/datadog': patch
---

Fixed spans from fire-and-forget work like Memory.generateTitle showing up as disconnected root traces in Datadog LLM Observability. Spans that arrive after the root span's tree has been emitted were sent one at a time under tracer.scope().activate(), but dd-trace only links LLMObs parents through enclosing llmobs.trace() callbacks, so every late span got parent_id "undefined" and rendered as its own root trace. Late-arriving span chains are now emitted as nested sub-trees, so a title generation run shows up as a single trace with its step, inference, and chunk spans properly nested.
