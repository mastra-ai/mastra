import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { innerAgent } from '@/agents';
import { testRoute } from '@/api/route/test';
import { createRouteRoute } from '@/api/route/create-route';
import { allRoute } from '@/api/route/all';
import { streamingRoute } from '@/api/route/streaming';
import { transitiveWorkspaceRoute } from '@/api/route/transitive-workspace';
import { myAgent } from '@inner/hello-world/agent';
import 'nodemailer';

export const mastra = new Mastra({
  agents: { innerAgent, myAgent },
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 3000,
    apiRoutes: [testRoute, createRouteRoute, allRoute, streamingRoute, transitiveWorkspaceRoute],
  },
  bundler: {
    externals: ['bcrypt'],
  },
  logger: new ConsoleLogger({ level: 'info' }),
});
