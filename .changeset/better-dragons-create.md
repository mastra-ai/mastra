---
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/server': patch
---

Fixed the browser screencast stream and session probe not finding workspace-level CLI browser providers. The server now falls back to the agent's workspace browser when no agent-level browser is configured. Fixes https://github.com/mastra-ai/mastra/issues/22535
