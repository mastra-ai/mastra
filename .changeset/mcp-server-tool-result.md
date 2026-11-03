---
'@mastra/mcp': minor
---

Added a `toolResult` option to `MCPServer` so tools can return images, audio, and files to MCP clients.

Set `toolResult.modelOutput: true` to build each result from the tool's `toModelOutput`, the same output an agent sends to its model. Images become `image` blocks, audio becomes `audio` blocks, and other files become embedded resources. For example, a workspace `read_file` of a PNG now reaches the client as an image instead of base64 inside JSON text.

```ts
const server = new MCPServer({
  id: 'media-server',
  name: 'Media Server',
  version: '1.0.0',
  tools: { screenshotTool },
  toolResult: { modelOutput: true },
})
```

Use `toolResult.transform` to rewrite any completed tool result before it is sent, for example to forward results that are already MCP-shaped from proxied tools.

Without the new option, results are unchanged. The default of `modelOutput` becomes `true` in the next major version; if your clients parse the raw JSON text of tools that define `toModelOutput`, set `modelOutput: false` to keep the current behavior.
