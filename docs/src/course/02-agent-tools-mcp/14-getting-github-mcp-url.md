# Setting Up the GitHub MCP Server

To connect your agent to GitHub, we'll use the [official GitHub MCP server](https://github.com/github/github-mcp-server) — a remote server hosted by GitHub that provides access to GitHub's API through MCP.

## Creating a GitHub Personal Access Token

You'll need a GitHub Personal Access Token (PAT) to authenticate with the server.

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. Give it a descriptive name (e.g., "Mastra Agent")
3. Select the repositories you want your agent to access
4. Under **Repository permissions**, grant at minimum:
   - **Issues**: Read
   - **Pull requests**: Read
   - **Contents**: Read
   - **Metadata**: Read (selected by default)
5. Click **Generate token** and copy it

Add the token to your `.env` file:

```bash
# Add this to your .env file
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token
```

Using an environment variable keeps your token secure and prevents it from being committed to your repository.
