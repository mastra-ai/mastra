---
'mastracode': patch
---

Added /memory-gateway command to configure the Mastra Gateway for model routing through server.mastra.ai. When a gateway API key is set, all models route through the gateway with full support for Claude Max OAuth and OpenAI Codex OAuth (including middleware like instructions and reasoning effort). Gateway-backed providers now appear in onboarding packs and show as authenticated in the model picker.
