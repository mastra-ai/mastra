import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { registerCopilotKit } from '@ag-ui/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { weatherAgent } from './agents';
import { myNetwork } from './network';

type WeatherRequestContext = {
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
    id: 'agui-storage',
    // stores observability, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
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
      registerCopilotKit<WeatherRequestContext>({
        path: '/copilotkit',
        resourceId: 'weatherAgent',
        setContext: (c, requestContext) => {
          requestContext.set('user-id', c.req.header('X-User-ID') || 'anonymous');
          requestContext.set('temperature-scale', 'celsius');
          requestContext.set('location', c.req.header('X-User-Location') || 'unknown');
        },
      }),
    ],
  },
});
