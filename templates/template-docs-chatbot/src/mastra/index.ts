import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { mcpServer } from './mcp/mcp-server';
import { planetsAgent } from './agents/planets-agent';

export const mastra = new Mastra({
  agents: {
    planetsAgent,
  },
  mcpServers: {
    planets: mcpServer,
  },
  server: {
    port: parseInt(process.env.PORT || '4112', 10),
    timeout: 30000,
    // Add health check endpoint for deployment monitoring
    apiRoutes: [
      registerApiRoute('/health', {
        method: 'GET',
        handler: async c => {
          return c.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            services: {
              agents: ['planetsAgent'],
              workflows: [],
            },
          });
        },
      }),
      registerApiRoute('/mcp/info', {
        method: 'GET',
        handler: async c => {
          return c.json({
            mcpServer: {
              name: 'Template Docs Chatbot MCP Server',
              version: '1.0.0',
              availableTransports: ['http', 'sse'],
              endpoints: {
                http: process.env.MCP_SERVER_URL || 'http://localhost:4111/mcp',
              },
              availableTools: ['linkCheckerTool', 'planetsInfoTool'],
              availableAgents: ['ask_planets'],
            },
          });
        },
      }),
    ],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
});
