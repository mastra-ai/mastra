---
'@mastra/core': minor
---

Add `TemperatureDeprecatedHandler`, an opt-in processor that recovers from models which dropped support for `temperature`, `top_p`, or `top_k` (for example Anthropic's `claude-opus-4-7`, which returns a 400 when `temperature` is sent). On that rejection it strips the unsupported sampling parameters from the call settings and retries the same model once. Register the same instance in both `inputProcessors` and `errorProcessors` to enable it. Closes #16247.
