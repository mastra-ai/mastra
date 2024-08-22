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
  systemHostURL: '',
  routeRegistrationPath: '',
  blueprintDirPath: '/arkw-blueprints',
};
