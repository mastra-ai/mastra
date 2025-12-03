import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { innerAgent } from '@/agents';
import { testRoute } from '@/api/route/test';
import { allRoute } from '@/api/route/all';
import { streamingRoute } from '@/api/route/streaming';
import { myAgent } from '@inner/hello-world/agent';
import { registerCopilotKit } from '@ag-ui/mastra/copilotkit';

export const mastra = new Mastra({
  agents: { innerAgent, myAgent },
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 3000,
    apiRoutes: [
      testRoute,
      allRoute,
      streamingRoute,
      registerCopilotKit({
        path: '/copilotkit',
      }),
    ],
  },
  bundler: {
    externals: ['bcrypt', '@ag-ui/langgraph', '@ag-ui/client', '@ag-ui/core', '@ag-ui/mastra', '@copilotkit/runtime'],
  },
  logger: new ConsoleLogger({ level: 'info' }),
});
