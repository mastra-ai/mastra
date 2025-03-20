---
'mastra': patch
---

When running pnpm create mastra and selecting to install MCP docs server for Windsurf, the prompt placement was confusing as there was an additional confirm step during initialization later. Now the prompts all happen at the same time. Also added a check so we don't re-install global Windsurf if it's already installed
