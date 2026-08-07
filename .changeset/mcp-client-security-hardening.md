---
'@mastra/mcp': minor
---

Add opt-in security hardening options to the MCP client. Both options are opt-in; default behavior is unchanged.

- `allowedHosts` on HTTP server configs restricts which hosts the client's HTTP requests may target, covering the initial connection, the SSE fallback, and OAuth discovery. On the default fetch path redirect hops are blocked before they are sent; with a custom `fetch`, the final response URL is validated after the request runs, so custom fetch implementations must enforce redirect policy themselves when preventing outbound contact is required.
- `inheritDefaultEnv: false` on stdio server configs stops the subprocess from inheriting the SDK's default environment variables; only the entries you list in `env` are passed.

```typescript
const mcp = new MCPClient({
  servers: {
    weather: {
      url: new URL('https://weather.example/mcp'),
      allowedHosts: ['weather.example'],
    },
    local: {
      command: 'npx',
      args: ['tsx', 'stdio-server.ts'],
      inheritDefaultEnv: false,
      env: { WEATHER_API_KEY: process.env.WEATHER_API_KEY! },
    },
  },
});
```
