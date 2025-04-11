import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { bigQueryAgent } from './agents/index';
import { createSession } from './routes/index';

export const mastra = new Mastra({
  agents: { bigQueryAgent },
  logger: createLogger({ name: 'BigQuery', level: 'info' }),
  server: {
    apiRoutes: [
      {
        path: '/api/sessions',
        method: 'POST',
        handler: async c => {
          const body = await c.req.json();
          const session = await createSession(body);
          return c.json(session);
        },
      },
    ],
  },
});
