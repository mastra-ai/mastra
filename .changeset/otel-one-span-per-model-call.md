---
'@mastra/otel-exporter': minor
---

Export token usage on the model call span only, so Langfuse, Phoenix and other OpenTelemetry backends count each call once and show per-call usage.

Previously the generation span (the whole agent loop) was exported as the `chat` call with the loop's total usage, and the model step and inference spans exported nothing. Backends could not show which call consumed the tokens, where output hit the length limit, or how the cache hit ratio changed between calls.

**Before**, a two-step tool-calling agent arrived at the backend as:

```
invoke_agent weather-agent
└── chat gpt-5                gen_ai.usage.input_tokens=146   ← loop total
    ├── model_step            (no attributes)
    │   └── model_inference   (no attributes)
    ├── execute_tool weather
    └── model_step            (no attributes)
        └── model_inference   (no attributes)
```

**After**, only the span that made the call carries `gen_ai.request.model`, the messages and `gen_ai.usage.*`:

```
invoke_agent weather-agent
└── model_generation gpt-5    (no usage)
    ├── agent_step weather-agent
    │   └── chat gpt-5        gen_ai.usage.input_tokens=61
    ├── execute_tool weather
    └── agent_step weather-agent
        └── chat gpt-5        gen_ai.usage.input_tokens=85
```

Backends sum the `chat` spans to the same total as before and can now show each call. When paired with an older `@mastra/observability` that does not emit inference spans, the generation span keeps the `chat` role as before. Dashboards that read usage from the old generation span should read the `chat` spans instead. Fixes #23872.
