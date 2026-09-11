---
'@mastra/core': patch
---

Fixed the model capability registry trusting a nested provider's capabilities over the gateway actually serving the request. When a gateway such as OpenRouter lists a routed model (e.g. `openrouter/deepseek/deepseek-v4-flash`) without attachment support, that answer is now authoritative instead of falling back to the upstream provider's file, which caused Observational Memory to forward images to endpoints that reject them ("No endpoints found that support image input").
