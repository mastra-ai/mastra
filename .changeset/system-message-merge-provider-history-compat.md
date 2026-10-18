---
'@mastra/core': patch
---

The single-system-message merge for OpenAI-compatible Chat Completions providers now runs in `ProviderHistoryCompat` instead of inside the model wrappers. Router models (`'groq/...'`, or a custom `url`) are matched by the API they resolve to, so `processLLMRequest` processors now receive that as `apiProviderId` (e.g. `groq.chat`, `openai.responses`). Turning off the default error processors (`errorProcessorDefaults: false`) now also turns off the merge.
