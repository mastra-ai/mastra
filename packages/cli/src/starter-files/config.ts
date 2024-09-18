import { Config } from '@kpl/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  //logConfig: {}, // TODO: Add this
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:REPLACE_DB_PORT/kepler?schema=kepler',
  },
  workflows: {
    blueprintDirPath: '/kepler-blueprints',
    systemEvents: {},
    systemApis: [],
  },
  systemHostURL: process.env.APP_URL!,
  routeRegistrationPath: '/api/kepler',
};
