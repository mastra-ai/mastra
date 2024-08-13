import config from '../../../mock-data/config.json';

import { Config } from './types';

export async function getIntegrations(): Promise<Config> {
  return new Promise(res => res(config as Config));
}
