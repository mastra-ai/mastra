---
'@mastra/agent-browser': patch
'@mastra/stagehand': patch
'@mastra/core': patch
---

Fixed AgentBrowser and StagehandBrowser failing to open a browser when used with the default configuration. Previously, using `new AgentBrowser()` without passing a specific thread ID would result in a "Browser not initialized" error. The browser now launches correctly out of the box without needing to set `scope: 'shared'` as a workaround. (Fixes #15283)
