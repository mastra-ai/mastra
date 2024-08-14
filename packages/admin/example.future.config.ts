import { Config, IntegrationAction, IntegrationEvent, IntegrationPlugin } from 'core';

export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [] as IntegrationAction[],
  systemEvents: [] as IntegrationEvent[],
  plugins: [] as IntegrationPlugin[],
  db: {
    provider: '',
    uri: '',
  },
};
