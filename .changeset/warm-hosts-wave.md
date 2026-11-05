---
'@mastra/playground-ui': minor
---

Added `McpAppHostProvider` to `@mastra/playground-ui/domains/mcps`, so a chat can extend the MCP Apps shown in its tool cards. Its value can send extra host context to each app and receive every `ui/update-model-context` the app sends. `McpAppViewer` also accepts the matching `hostContext` and `onModelContext` props directly.
