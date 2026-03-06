import { Mastra } from '@mastra/core';

import { slackRoutes } from './slack/routes.js';

const PORT = Number(process.env.PORT) || 4211;

export const mastra = new Mastra({
  server: {
    host: '0.0.0.0',
    port: PORT,
    apiRoutes: slackRoutes,
  },
});
