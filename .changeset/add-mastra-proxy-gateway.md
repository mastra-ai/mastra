---
'@mastra/core': minor
---

Add MastraProxyGateway — a catch-all gateway that routes all LLM requests through a proxy server while preserving native SDK features per provider (Anthropic streaming, OpenAI Responses API, Google Gemini chat, etc.).

- Added `matchesModel()` to `MastraModelGateway` base class for catch-all gateway support
- Updated `findGatewayForModel` to prioritize `matchesModel()` gateways over prefix-based matching
- Added `getGatewayPrefix()` helper to `ModelRouterLanguageModel` for generalized no-prefix gateway detection
- Exported `MastraProxyGateway` and `MastraProxyGatewayConfig` from `@mastra/core/llm`
