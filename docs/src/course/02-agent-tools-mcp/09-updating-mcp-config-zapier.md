# Updating Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the Zapier server:

```typescript
const mcp = new MCPClient({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ''),
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.ZAPIER_MCP_API_KEY}`,
        },
      },
    },
  },
})
```

This configuration tells your agent how to connect to the Zapier MCP server. Here is what each part does:

- **`zapier`**: A unique identifier for this server in your configuration
- **`url`**: The Zapier MCP server endpoint, read from your `.env` file
- **`requestInit.headers`**: HTTP headers sent with every request to the server
- **`Authorization: Bearer ...`**: Your API key, sent as a Bearer token to authenticate with Zapier

The `new URL()` constructor creates a URL object from the string provided by the environment variable. The `|| ""` part provides a default empty string in case the environment variable is not set, which prevents your application from crashing if the environment variable is missing.

The `requestInit` option lets you customize HTTP requests to the MCP server. Zapier requires an `Authorization` header with your API key in `Bearer {apiKey}` format to verify your identity on every request.
