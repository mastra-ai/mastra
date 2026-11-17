---
'@mastra/sentry': minor
---

Reasoning tokens now use `gen_ai.usage.reasoning.output_tokens`, the name that Sentry reads. `gen_ai.tool.definitions` is now a list of `{ type, name }` objects instead of a list of tool names. `gen_ai.provider.name` now uses the OpenTelemetry provider names, such as `openai` for `openai.chat`. Each message in `gen_ai.output.messages` now has a `finish_reason`.
