import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { chefAgent, chefAgentResponses, dynamicAgent } from './agents/index';
import { myMcpServer, myMcpServerTwo } from './mcp/server';
import { myWorkflow } from './workflows';
import { DefaultConsoleExporter, LangfuseExporter } from '@mastra/core/telemetry_vnext';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  agents: { chefAgent, chefAgentResponses, dynamicAgent },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage,
  mcpServers: {
    myMcpServer,
    myMcpServerTwo,
  },
  workflows: { myWorkflow },
  serverMiddleware: [
    {
      handler: (c, next) => {
        return next();
      },
    },
  ],
  telemetryVNext: {
    enabled: true,
    serviceName: 'quickstart-example',
    exporters: [
      new DefaultConsoleExporter(),
      ...(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
        ? [
            new LangfuseExporter({
              publicKey: process.env.LANGFUSE_PUBLIC_KEY,
              secretKey: process.env.LANGFUSE_SECRET_KEY,
              baseUrl: process.env.LANGFUSE_BASE_URL,
              options: {
                debug: process.env.NODE_ENV === 'development',
              },
            }),
          ]
        : []),
    ],
  },
});
