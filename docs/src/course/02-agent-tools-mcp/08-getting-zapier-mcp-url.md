# Getting a Zapier MCP URL and API key

First, you'll need to get a Zapier MCP URL and API key. This requires:

1. Creating a Zapier account at [zapier.com](https://zapier.com) if you don't have one
2. Going to [mcp.zapier.com](https://mcp.zapier.com) and selecting **+ New MCP Server**
3. Choosing **OpenAI API** as the client type: This provides API Key authentication, which works well with custom MCP clients like Mastra
4. Adding tools to your server (e.g., search for "Gmail" and add "Find Email" and "Send Email")
5. Selecting the **Connect** tab to find your **MCP Server URL** and **API Key** (select **Rotate token** to generate one if needed)

**Important:** Copy your API key immediately when it is shown. Zapier only displays it once. If you lose it, generate a new one by selecting **Rotate token**.

Add both values to your `.env` file:

```bash
# Add these to your .env file
ZAPIER_MCP_URL=https://mcp.zapier.com/api/v1/connect
ZAPIER_MCP_API_KEY=your-api-key-here
```

Using environment variables keeps your credentials out of your source code. Ensure `.env` is listed in your `.gitignore` file.
