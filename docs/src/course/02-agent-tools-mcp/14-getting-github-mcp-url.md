# Getting a Composio GitHub MCP URL

First, you'll need to get a Composio GitHub MCP URL. This typically requires:

1. Setting up the Composio GitHub integration
2. Authenticating with your GitHub account
3. Getting your unique MCP URL

For this example, we'll use an environment variable to store the URL:

```bash
# Add this to your .env file
COMPOSIO_MCP_GITHUB=https://your-composio-github-mcp-url.com
```

Using an environment variable keeps your configuration secure and flexible. This approach allows you to easily switch between different GitHub accounts or environments without modifying your code. It also prevents sensitive information from being committed to your repository.
