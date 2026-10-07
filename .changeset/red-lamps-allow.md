---
'@mastra/mcp': minor
---

`MCPServer` now announces its full identity to MCP clients: `title`, `description`, `websiteUrl`, and `icons`, alongside `name` and `version`. Clients, including `MCPClient.getServerInfo()`, can show a display title, description, website, and logo for a Mastra server instead of only its name. The registry server info returned by `getServerInfo()` on the server is unchanged. Fixes #25856.

```typescript
const server = new MCPServer({
  name: 'weather-server',
  version: '1.0.0',
  title: 'Weather Server',
  description: 'Forecasts and current conditions',
  websiteUrl: 'https://weather.example.com',
  icons: [{ src: 'https://weather.example.com/icon.png', mimeType: 'image/png', sizes: ['48x48'] }],
  tools: { weatherTool },
});
```

`@mastra/mcp` now requires `@mastra/core` 1.75.0 or later.
