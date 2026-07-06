---
"@mastra/core": minor
---

models.dev gateway: honor per-model `provider` overrides (endpoint, request shape, SDK).

A provider can now serve individual models over a different base URL / request shape than the provider default — e.g. a model served over the OpenAI **Responses** API while the provider default is chat-completions. The models.dev gateway now reads each model's `provider` block (`api`, `shape`, `npm`), so `resolveLanguageModel` routes `shape: "responses"` models via the OpenAI Responses API and `buildUrl` prefers a per-model `api` when present. Providers without per-model overrides are unaffected.
