---
'mastracode': minor
---

Route LLM calls through a proxy and manage gateway-backed memory via two new slash commands. Use `/llm-proxy` to set a base URL and custom headers — all model requests will be forwarded through it. Use `/memory-gateway` to configure an API key (and optional base URL) for Mastra's cloud memory service; when the memory gateway is active, local Observational Memory is automatically disabled. Custom providers now also support per-provider headers.

Model router fallback now uses `MastraProxyGateway` from `@mastra/core` instead of raw URL passthrough, preserving native SDK features (Anthropic streaming, OpenAI Responses API, etc.) when routing through a proxy. Memory gateway is gated behind `ENABLE_MASTRA_MEMORY_GATEWAY=true` environment variable.
