---
'@mastra/mcp': patch
'@mastra/connect': patch
---

Require `@mastra/core >=1.83.0-0 <2.0.0-0` when installing MCP or Connect to avoid imports missing from core 1.82. For existing installations, upgrade core alongside these packages (for example, replace `@mastra/core@1.82.0` with `@mastra/core@1.83.0`).
