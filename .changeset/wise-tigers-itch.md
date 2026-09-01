---
'@mastra/deployer': patch
'@mastra/server': patch
---

Fixed the Studio browser viewer not finding CLI browser providers configured via `Workspace.browser` (such as `@mastra/browser-viewer`) until the agent had handled a request. The viewer now resolves the browser from the workspace as well as the agent. Fixes https://github.com/mastra-ai/mastra/issues/22537
