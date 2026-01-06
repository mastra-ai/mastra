---
'@mastra/ai-sdk': patch
---

Fix chat route to use agent ID instead of agent name for resolution. The `/chat/:agentId` endpoint now correctly resolves agents by their ID property (e.g., `weather-agent`) instead of requiring the camelCase variable name (e.g., `weatherAgent`). This fixes issue #10469 where URLs like `/chat/weather-agent` would return 404 errors.

