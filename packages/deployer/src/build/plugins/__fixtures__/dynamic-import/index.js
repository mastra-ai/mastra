import { Mastra } from '@mastra/core/mastra';
import { ROUTE_LABEL } from './paths.js';

const fixture = process.env.LOAD_FIXTURE === 'true' ? await import('./fixture.js') : undefined;

export const mastra = new Mastra({
  server: {
    port: 4199,
    apiRoutes: [
      {
        path: '/repro',
        method: 'GET',
        handler: c => c.json({ route: ROUTE_LABEL, fixture: fixture?.fixtureLabel() ?? null }),
      },
    ],
  },
});
