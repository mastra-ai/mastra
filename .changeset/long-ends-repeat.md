---
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/server': patch
'mastra': patch
---

Fixed the Studio browser viewer never mounting for CLI browser providers like @mastra/browser-viewer. Agents now report a hasBrowser capability that covers workspace-level CLI browsers (which expose no SDK tools), and Studio uses it to enable the browser session probe and screencast stream. Fixes https://github.com/mastra-ai/mastra/issues/22535
