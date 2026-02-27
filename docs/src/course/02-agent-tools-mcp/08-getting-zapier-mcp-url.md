# Getting Your Zapier MCP URL and API Key

To connect your Mastra agent to Zapier MCP, you need a **Server URL** and an **API Key**. Follow these steps to get both from the Zapier dashboard.

## Step 1: Create a Zapier Account

If you don't have a Zapier account, sign up at [zapier.com](https://zapier.com). Zapier MCP is included in your existing Zapier plan.

## Step 2: Create a New MCP Server

1. Go to [mcp.zapier.com](https://mcp.zapier.com)
2. Select **+ New MCP Server**
3. When asked to choose a client, select **OpenAI API**: This provides API Key authentication, which works well with custom MCP clients like Mastra
4. Give your server a name (or keep the default) and select **Create MCP Server**

## Step 3: Add Tools to Your Server

After creating the server, you'll be taken to the server dashboard where you can add actions:

1. Type an app name (e.g., "Gmail") in the search bar
2. Select the actions you want (e.g., "Find Email", "Send Email")
3. When prompted, connect your Gmail (or other app) account by signing in
4. Repeat for any other apps you want your agent to use

## Step 4: Get Your URL and API Key

1. Select the **Connect** tab at the top of your MCP server dashboard
2. You will see two pieces of information:
   - **MCP Server URL**: `https://mcp.zapier.com/api/v1/connect`
   - **API Key**: A long string of characters (select **Rotate token** to generate one if you don't have one yet)

**Important:** Copy your API key immediately when it is shown. Zapier only displays it once. If you lose it, generate a new one by selecting **Rotate token**.

## Step 5: Add to Your Environment Variables

Add both values to your `.env` file:

```bash
# Add these to your .env file
ZAPIER_MCP_URL=https://mcp.zapier.com/api/v1/connect
ZAPIER_MCP_API_KEY=your-api-key-here
```

Replace `your-api-key-here` with the API key you copied from the Zapier dashboard.

Using environment variables keeps your credentials out of your source code. Never commit your `.env` file to version control. Ensure `.env` is listed in your `.gitignore` file.
