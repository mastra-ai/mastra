import { Config } from '@kpl/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  //logConfig: {}, // TODO: Add this
  systemApis: [],
  systemEvents: {},
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:REPLACE_DB_PORT/kepler?schema=kepler',
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
  blueprintDirPath: '/kepler-blueprints',
};
