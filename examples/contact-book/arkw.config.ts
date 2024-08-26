import { Config } from '@arkw/core';

export const config: Config = {
  name: 'contact-book',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: {},
  integrations: [],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:5433/arkwright?schema=arkw',
  },
  systemHostURL: '',
  routeRegistrationPath: '/api/arkw',
  blueprintDirPath: '/arkw-blueprints',
};
