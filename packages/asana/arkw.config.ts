import { Config } from '@arkw/core';

import { AsanaIntegration } from './src';

export const config: Config = {
  name: 'ASANA',
  db: {
    provider: 'postgresql',
    uri: process.env.DATABASE_URL!,
  },
  systemApis: [],
  systemEvents: {},
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/mock-data/blueprints',
  systemHostURL: process.env.APP_URL!,
  integrations: [
    new AsanaIntegration({
      config: {
        CLIENT_ID: process.env.CLIENT_ID!,
        CLIENT_SECRET: process.env.CLIENT_SECRET!,
        REDIRECT_URI: '/api/ark/callback',
      },
    }),
  ],
};
