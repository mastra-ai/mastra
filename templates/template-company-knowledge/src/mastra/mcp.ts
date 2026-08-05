import { MCPClient } from '@mastra/mcp';
import { createRequire } from 'node:module';
import '@notionhq/notion-mcp-server/package.json';

const require = createRequire(import.meta.url);
const notionMcpServerPath = require.resolve('@notionhq/notion-mcp-server/bin/cli.mjs');

/**
 * MCP clients for Linear and Notion.
 *
 * Linear — hosted remote MCP server at https://mcp.linear.app/mcp
 *   Supports Bearer token auth with a Linear API key.
 *
 * Notion — local stdio subprocess via the installed @notionhq/notion-mcp-server package.
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
            command: 'node',
            args: [notionMcpServerPath],
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
