# Troubleshooting

If your agent can't access the Zapier tools, check:

1. That your `.env` file has both `ZAPIER_MCP_URL` and `ZAPIER_MCP_API_KEY` set
2. That your MCP config includes `requestInit.headers` with the `Authorization: Bearer` header
3. That you've added actions to your Zapier MCP server at [mcp.zapier.com](https://mcp.zapier.com)
4. That the tools are properly loaded by checking the Tools tab in the playground

Common issues include:

- **401 "Missing OAuth authorization header"**: Your config is missing the `requestInit.headers` block. Zapier MCP requires an `Authorization` header on every request.
- **401 "Invalid OAuth token"**: Your API key is incorrect or expired. Copy it again from the Zapier MCP dashboard (**Connect** tab), or select **Rotate token** to generate a new one.
- **No tools besides `zapier_get_configuration_url`**: You haven't added actions (e.g., Gmail) to your MCP server on the Zapier dashboard, or you haven't connected your app accounts.
- **Environment variables not loading**: Restart your development server after changing `.env` values. Environment variables are read at startup.

If you're having trouble, check the terminal output when running `npm run dev` for error messages. The MCPClient logs connection errors with details about what went wrong.

In the next step, you'll add the GitHub MCP server to give your agent the ability to monitor and interact with GitHub repositories.
