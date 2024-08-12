import { Config, IntegrationAction, IntegrationEvent } from 'core';

// TODO: Fix
import { IntegrationPlugin } from '../core/src/plugin';

export const config: Config = {
  name: 'kepler',
  //dbConnectionConfig: {}, // TODO: Add this
  //logConfig: {}, // TODO: Add this
  systemActions: [] as IntegrationAction[],
  systemEvents: [] as IntegrationEvent[],
  plugins: [] as IntegrationPlugin[], // TODO will update after plugins are moved.
};
