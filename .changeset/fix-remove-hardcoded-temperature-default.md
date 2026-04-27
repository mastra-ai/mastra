---
'@mastra/core': patch
---

Fixed agents forcing `temperature: 0` when the user did not explicitly set it. Previously, every `agent.stream()` / `agent.generate()` call silently injected `temperature: 0` into model settings, which broke models that restrict acceptable temperature values (for example Moonshot Kimi K2.5, which only accepts `temperature=1` and rejects any other value with `400 Bad Request`). The model provider's own default is now used when the user does not configure a temperature. Users who explicitly set `temperature` (including `temperature: 0` for deterministic output) are unaffected. Fixes [#15240](https://github.com/mastra-ai/mastra/issues/15240).
