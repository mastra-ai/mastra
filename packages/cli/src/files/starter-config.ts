import { Config } from '@arkw/core';

export const config: Config = {
  name: 'PROJECT_NAME',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: {},
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:REPLACE_DB_PORT/arkwright?schema=arkw',
  },
  systemHostURL: '',
  routeRegistrationPath: '',
  blueprintDirPath: '/arkw-blueprints',
};
