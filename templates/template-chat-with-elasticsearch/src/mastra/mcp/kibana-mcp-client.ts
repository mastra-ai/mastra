import { MCPClient } from '@mastra/mcp';

const KIBANA_MCP_URL = process.env.KIBANA_MCP_URL;
const ELASTICSEARCH_API_KEY = process.env.ELASTICSEARCH_API_KEY;

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
