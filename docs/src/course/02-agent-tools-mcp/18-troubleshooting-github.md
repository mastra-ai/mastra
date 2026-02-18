# Troubleshooting

If your agent can't access the GitHub tools, check:

1. That the Smithery CLI OAuth flow completed successfully (a browser window should have opened on first use)
2. That the tools are properly loaded by checking the Tools tab in the playground
3. That you have the necessary permissions for the repositories you're trying to access

Common issues include:

- OAuth consent not completed — re-run the agent to trigger the browser prompt again
- Network issues preventing the Smithery CLI from reaching the server
- Permission problems with the repositories you're trying to access

If you're having trouble, try checking the console logs for any error messages related to the GitHub MCP server. These can provide valuable clues about what might be going wrong.

In the next step, we'll add the Hacker News MCP server to give your agent access to tech news and discussions.
