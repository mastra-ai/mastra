# Getting a GitHub MCP Server

For this course, we'll use the **Smithery CLI**. On first use, it opens a browser to complete OAuth consent. Alternatively, you can use the official GitHub MCP server directly.

## Option 1: Using Smithery CLI (Recommended for this course)

The Smithery CLI manages OAuth authentication interactively. When you first connect, it will prompt you to authenticate via your browser.

```bash
# No installation needed - we'll use npx to run it
# On first use, the CLI opens a browser window for OAuth consent
```

We'll configure the MCP client to use Smithery's GitHub server via their CLI in the next step.

## Option 2: Using the Official GitHub MCP Server

Alternatively, you can use the official GitHub MCP server directly:

```bash
pnpm install @modelcontextprotocol/server-github
```

This requires a GitHub Personal Access Token:

```bash
# Add this to your .env file
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token
```

You can create a token at [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens).

## What We'll Use

For this course, we'll proceed with **Option 1 (Smithery CLI)**. The CLI prompts you to authenticate via browser on first use, eliminating the need to manually create and manage GitHub tokens.
