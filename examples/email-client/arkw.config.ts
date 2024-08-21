import { Config } from '@arkw/core';

export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: [],
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=future',
  },
  systemHostURL: 'http://localhost:3000', // Example value
  routeRegistrationPath: '/api/routes', // Example value
  blueprintDirPath: '/src/blueprints',
};
