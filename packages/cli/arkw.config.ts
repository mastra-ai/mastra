import { Config } from 'core';

export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: [],
  plugins: [
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=future',
  },
};