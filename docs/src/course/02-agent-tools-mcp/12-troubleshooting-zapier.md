# Troubleshooting

If your agent can't access the Zapier tools, here are the most common issues and how to fix them.

## 401 Unauthorized / "Missing OAuth authorization header"

This means your request is missing authentication. Check:

1. **Your `.env` file has both variables set:**

   ```bash
   ZAPIER_MCP_URL=https://mcp.zapier.com/api/v1/connect
   ZAPIER_MCP_API_KEY=your-actual-api-key
   ```

2. **Your MCP config includes `requestInit.headers`:**

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

   A common mistake is configuring only the `url` without the `requestInit.headers`. Zapier MCP requires an `Authorization` header on every request.

3. **Restart your development server** after changing `.env` values. Environment variables are read at startup, so changes won't take effect until you restart with `npm run dev`.

## 401 "Invalid OAuth token - please re-authenticate"

This means an `Authorization` header is being sent, but the token is invalid. Check:

1. **Your API key is correct**: Copy it again from the Zapier MCP dashboard (**Connect** tab). If you can't see it, select **Rotate token** to generate a new one and update your `.env` file.
2. **No extra spaces or quotes** around the API key value in your `.env` file.
3. **The URL matches**: Ensure you're using `https://mcp.zapier.com/api/v1/connect` (not a different URL from a different server type).

## No tools showing up

If the connection succeeds but you don't see any tools besides `zapier_get_configuration_url`:

1. Go back to [mcp.zapier.com](https://mcp.zapier.com) and open your MCP server
2. Ensure you've added actions (e.g., Gmail → Find Email, Send Email)
3. Ensure you've connected your app accounts (e.g., signed into Gmail)
4. Restart your development server

## Other common issues

- **Network connectivity problems**: Ensure you can reach `mcp.zapier.com` from your machine.
- **Outdated packages**: Run `npm update @mastra/mcp` to get the latest version.
- **Environment variable not loaded**: Ensure your `.env` file is in the project root (same directory as `package.json`).

If you're still having trouble, check the terminal output when running `npm run dev` for error messages. The MCPClient logs connection errors with details about what went wrong.

In the next step, you'll add the GitHub MCP server to give your agent the ability to monitor and interact with GitHub repositories.
