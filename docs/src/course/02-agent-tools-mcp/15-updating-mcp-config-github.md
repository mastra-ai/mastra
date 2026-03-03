# Updating Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the GitHub server:

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
    github: {
      url: new URL('https://api.githubcopilot.com/mcp/'),
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        },
      },
    },
  },
})
```

This configuration adds the GitHub MCP server alongside the Zapier server we added in the previous step. The `github` key is a unique identifier for this server in your configuration.

**How it works:**

- The `url` property points to GitHub's hosted remote MCP server
- The `requestInit.headers` property passes your Personal Access Token for authentication
- The server uses Streamable HTTP transport, the same protocol used by the Zapier server

By adding multiple servers to your MCP configuration, you're building a more versatile agent that can access a wider range of tools and services. Each server adds its own set of capabilities to your agent.
