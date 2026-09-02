---
'@mastra/langfuse': patch
---

Map the root span's input/output to `langfuse.trace.input`/`langfuse.trace.output` so Langfuse traces carry trace-level input and output again. Previously the exporter only mapped input/output onto observations, leaving every trace's top-level input/output empty — which broke LLM-as-a-judge evaluators bound to Trace input/output and removed the request/response summary from the Langfuse trace view. User-facing behavior otherwise unchanged; existing trace name/tags/metadata mappings take the same precedence as before.
