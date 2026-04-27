# Troubleshooting

If your agent can't access the GitHub tools, check:

1. That your `GITHUB_PERSONAL_ACCESS_TOKEN` is set correctly in your `.env` file
2. That your token has the required repository permissions (Issues, Pull requests, Contents, Metadata)
3. That the tools are properly loaded by checking the Tools tab in the playground

Common issues include:

- Missing or expired Personal Access Token — generate a new one at [GitHub Settings](https://github.com/settings/personal-access-tokens)
- Insufficient token permissions — ensure your token has read access to the repositories you're targeting
- Network issues preventing the connection to `api.githubcopilot.com`

If you're having trouble, try checking the console logs for any error messages related to the GitHub MCP server. These can provide valuable clues about what might be going wrong.

In the next step, we'll add the Hacker News MCP server to give your agent access to tech news and discussions.
