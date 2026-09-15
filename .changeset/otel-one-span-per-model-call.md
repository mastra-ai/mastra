---
'@mastra/otel-exporter': minor
---

Export token usage on the model call span only, so OpenTelemetry backends such as Langfuse and Phoenix count each call once and show per-call usage. Fixes #23872.

- `model_inference` is exported as `chat {model}` with model, messages, `gen_ai.usage.*` and response attributes.
- `model_generation` is now a parent span without model or usage attributes.
- `model_step` is exported as `agent_step` with `mastra.model_step.step_index` and `is_continued`.
- Paired with an older `@mastra/observability` that emits no inference spans, `model_generation` keeps the `chat` role as before.

No configuration change is needed:

```ts
new OtelExporter({ provider: { custom: { endpoint: 'http://localhost:4318/v1/traces' } } });
```

Dashboards that read usage from the `chat {model}` generation span should read the per-call `chat` spans instead; the trace total is unchanged.
