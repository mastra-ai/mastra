import { Config } from '@/types';

import config from '../../mock-data/config.json';

export async function getConfig(): Promise<Config> {
  return new Promise(res => res(config as unknown as Config));
}
