import { MCPClient } from '@mastra/mcp';
import { createRequire } from 'node:module';
import '@notionhq/notion-mcp-server/package.json';

const require = createRequire(import.meta.url);
const notionMcpServerPath = require.resolve('@notionhq/notion-mcp-server/bin/cli.mjs');

/**
 * Optional MCP clients for exporting meeting notes.
 *
 * Linear — hosted remote MCP server at https://mcp.linear.app/mcp
 *   Used to create issues from action items. Needs LINEAR_API_KEY.
 *
 * Notion — local stdio subprocess via the installed @notionhq/notion-mcp-server package.
 *   Used to push meeting notes to Notion pages. Needs NOTION_API_KEY.
 *
 * Both are gated: if the env var is missing, the server isn't connected.
 */
export const mcpClient = new MCPClient({
  id: 'meeting-notes-mcp',
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
