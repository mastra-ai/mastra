---
'@mastra/core': patch
---

Prevent LLM model and gateway credentials from leaking into observability spans.

**What changed**

- `ModelRouterLanguageModel` now implements `serializeForSpan()`, returning only `modelId`, `provider`, `gatewayId`, and `specificationVersion`. The underlying gateway and OpenAI-compatible config (`apiKey`, `headers`, `url`) are no longer walked when the model appears in a span input, output, attribute, or metadata.
- Gateway classes (`MastraGateway`, `NetlifyGateway`, `ModelsDevGateway`, `AzureOpenAIGateway`) inherit a `serializeForSpan()` from `MastraModelGateway` that exposes only the gateway `id` and `name`. Credentials, cached OAuth tokens, and management secrets can no longer leak.
- `MastraVoice` implements `serializeForSpan()` to exclude `apiKey` fields on `listeningModel`, `speechModel`, and `realtimeConfig`.

**Why**

TypeScript `private` is compile-time only; at runtime those fields are enumerable and were being walked by span serialization, leaking credentials into telemetry backends (Datadog, etc.).
