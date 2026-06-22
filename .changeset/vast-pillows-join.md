---
'@mastra/server': minor
---

Added the AUTO_BLOCK_EXTERNAL_PROVIDERS environment variable. When set to `true` or `1`, Mastra Studio hides all external model providers (OpenAI, Anthropic, Gemini, etc.) and the built-in gateways, showing only the custom gateways you register. This lets enterprise deployments that route through their own gateway present just that gateway in the model picker.

```bash
AUTO_BLOCK_EXTERNAL_PROVIDERS=true
```
