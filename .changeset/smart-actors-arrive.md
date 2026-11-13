---
'@mastra/otel-exporter': minor
---

OTLP traces and logs now declare OpenTelemetry semantic conventions 1.41.0 with a schema URL. Backends that read attributes by version now read the GenAI attributes correctly, including the cache token counts. No configuration is needed. Traces sent through a custom `exporter` declare no version, because that exporter can change the attributes.

Other attribute changes that follow 1.41.0:

- Reasoning tokens now use `gen_ai.usage.reasoning.output_tokens`. Update any queries or dashboards that use `gen_ai.usage.reasoning_tokens`.
- `gen_ai.tool.definitions` is now a list of `{ type, name }` objects instead of a list of tool names.
- `gen_ai.system_instructions` is now a list of text parts, such as `[{"type":"text","content":"..."}]`, instead of plain text.
- Each message in `gen_ai.output.messages` now has a `finish_reason`. The reason is `unknown` when the model did not report one.
- `gen_ai.request.stop_sequences` and `gen_ai.response.finish_reasons` are now lists instead of JSON text.
- Agent run spans now include `gen_ai.provider.name`, and workflow run spans now include `gen_ai.workflow.name`.
- `gen_ai.provider.name` now uses the OpenTelemetry provider names for AI SDK provider ids, such as `openai` for `openai.chat` and `gcp.vertex_ai` for `google.vertex.chat`.
- If you create a `SpanConverter` yourself, pass `format: 'GenAI_v1_41_0'`. The old `'GenAI_v1_38_0'` value no longer type-checks.
