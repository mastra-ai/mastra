import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { registerCopilotKit } from '@mastra/agui';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { weatherAgent } from './agents';
import { myNetwork } from './network';

type WeatherRuntimeContext = {
  'user-id': string;
  'temperature-scale': 'celsius' | 'fahrenheit';
  location: string;
};

export const mastra = new Mastra({
  agents: { weatherAgent },
  networks: {
    myNetwork,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    cors: {
      origin: '*',
      allowMethods: ['*'],
      allowHeaders: ['*'],
    },
    apiRoutes: [
      registerCopilotKit<WeatherRuntimeContext>({
        path: '/copilotkit',
        resourceId: 'weatherAgent',
        setContext: (c, runtimeContext) => {
          runtimeContext.set('user-id', c.req.header('X-User-ID') || 'anonymous');
          runtimeContext.set('temperature-scale', 'celsius');
          runtimeContext.set('location', c.req.header('X-User-Location') || 'unknown');
        },
      }),
    ],
  },
});
