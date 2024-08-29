import { Config } from '@arkw/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  //logConfig: {}, // TODO: Add this
  systemApis: [],
  systemEvents: {},
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:REPLACE_DB_PORT/arkwright?schema=arkw',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/arkw-blueprints',
};
