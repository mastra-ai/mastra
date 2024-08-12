import { Config, IntegrationAction, IntegrationEvent } from 'core';

// TODO: Fix
import { IntegrationPlugin } from '../core/src/plugin';

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
