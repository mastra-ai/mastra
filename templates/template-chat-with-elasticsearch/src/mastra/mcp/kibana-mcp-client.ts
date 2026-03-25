import { MCPClient } from '@mastra/mcp';

const KIBANA_MCP_URL = process.env.KIBANA_MCP_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

/**
 * MCP client for connecting to Kibana's MCP server, or null if not configured.
 */
export const kibanaMcpClient = KIBANA_MCP_URL
  ? new MCPClient({
      servers: {
        kibana: {
          url: new URL(KIBANA_MCP_URL),
          requestInit: ELASTICSEARCH_API_KEY
            ? {
                headers: {
                  Authorization: `ApiKey ${ELASTICSEARCH_API_KEY}`,
                },
              }
            : undefined,
        },
      },
    })
  : null;

/**
 * Retrieves available tools from the Kibana MCP server.
 * @returns Object mapping tool names to tool definitions, or empty object if unavailable.
 */
export async function getKibanaMcpTools(): Promise<Record<string, unknown>> {
  if (!kibanaMcpClient) {
    return {};
  }

  try {
    const tools = await kibanaMcpClient.listTools();
    return tools;
  } catch (error) {
    console.warn('Failed to connect to Kibana MCP server:', error);
    return {};
  }
}
