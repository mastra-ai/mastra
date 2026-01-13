import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger } from '@mastra/core/logger';
import { innerAgent } from '@/agents';
import { testRoute } from '@/api/route/test';
import { allRoute } from '@/api/route/all';
import { streamingRoute } from '@/api/route/streaming';
import { directoryImportRoute } from '@/api/route/directory-import';
import { pathAliasRoute } from '@/api/route/path-alias';
import { myAgent } from '@inner/hello-world/agent';

export const mastra = new Mastra({
  agents: { innerAgent, myAgent },
  server: {
    port: process.env.MASTRA_PORT ? parseInt(process.env.MASTRA_PORT) : 3000,
    apiRoutes: [testRoute, allRoute, streamingRoute, directoryImportRoute, pathAliasRoute],
  },
  bundler: {
    externals: ['bcrypt'],
  },
  logger: new ConsoleLogger({ level: 'info' }),
});
