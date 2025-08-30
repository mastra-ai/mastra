import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { meetingSchedulerAgent } from './agents/meeting-scheduler';

export const mastra = new Mastra({
  agents: { meetingSchedulerAgent },
  storage: new LibSQLStore({
    url: 'file:../../mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const runtimeContext = c.get('runtimeContext');

          // TODO: Retrieve unique user id and set it on the runtime context
          // Consider using Authentication headers for user identification
          // e.g const bearerToken = c.get('Authorization')
          // https://mastra.ai/en/docs/server-db/middleware#common-examples
          const userId = 'unique-user-id';

          runtimeContext.set('userId', userId);

          return next();
        },
        path: '/api/*',
      },
    ],
  },
});
