---
'@mastra/deployer': patch
---

Fixed the browser screencast stream and session probe not finding workspace-level CLI browser providers. The server's browser stream `getToolset` now falls back to the agent's workspace browser when no agent-level browser is configured. Fixes https://github.com/mastra-ai/mastra/issues/22535
