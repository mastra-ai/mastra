import { MCPClient } from '@mastra/mcp';

/**
 * MCP clients for Linear and Notion.
 *
 * Linear — hosted remote MCP server at https://mcp.linear.app/mcp
 *   Supports Bearer token auth with a Linear API key.
 *
 * Notion — local stdio subprocess via @notionhq/notion-mcp-server
 *   Reads NOTION_API_KEY from OPENAPI_MCP_HEADERS env.
 */
export const mcpClient = new MCPClient({
  id: 'company-knowledge-mcp',
  servers: {
    ...(process.env.LINEAR_API_KEY
      ? {
          linear: {
            url: new URL('https://mcp.linear.app/mcp'),
            requestInit: {
              headers: {
                Authorization: `Bearer ${process.env.LINEAR_API_KEY}`,
              },
            },
          },
        }
      : {}),
    ...(process.env.NOTION_API_KEY
      ? {
          notion: {
            command: 'npx',
            args: ['-y', '@notionhq/notion-mcp-server'],
            env: {
              OPENAPI_MCP_HEADERS: JSON.stringify({
                Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
                'Notion-Version': '2022-06-28',
              }),
            },
          },
        }
      : {}),
  },
});
