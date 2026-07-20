---
'mastra': patch
'@mastra/deployer': patch
'@mastra/deployer-vercel': patch
---

Added a dedicated Agent Learning endpoint to Studio configuration so Signals reads can connect directly to the platform output service:

```bash
MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT=https://output.signals.mastra.ai
```
