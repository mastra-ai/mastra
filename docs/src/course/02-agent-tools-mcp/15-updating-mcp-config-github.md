# Updating Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the GitHub server using Smithery CLI:

```typescript
const mcp = new MCPClient({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ""),
    },
    github: {
      command: "npx",
      args: [
        "-y",
        "@smithery/cli@latest",
        "run",
        "@smithery-ai/server-github",
        "--config",
        "{}",
      ],
    },
  },
});
```

This configuration adds the GitHub MCP server alongside the Zapier server we added in the previous step. The `github` key is a unique identifier for this server in your configuration.

**How it works:**

- The `command` property specifies we're using `npx` to run the Smithery CLI
- The `args` array contains the arguments to pass to the CLI
- Smithery CLI will handle OAuth authentication automatically on first use
- You'll be prompted to authenticate via your browser when the agent first tries to use GitHub tools

By adding multiple servers to your MCP configuration, you're building a more versatile agent that can access a wider range of tools and services. Each server adds its own set of capabilities to your agent.

:::tip OAuth Authentication
When you first run your agent with this configuration, Smithery will open a browser window for you to authenticate. This is a one-time setup, and your credentials will be securely stored for future use.
:::
