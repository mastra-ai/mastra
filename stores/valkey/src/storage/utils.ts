import type { ValkeyClient, ValkeyConfig } from './types';

export function isClientConfig(config: ValkeyConfig): config is ValkeyConfig & { client: ValkeyClient } {
  return 'client' in config;
}

export function isConnectionStringConfig(config: ValkeyConfig): config is ValkeyConfig & { connectionString: string } {
  return 'connectionString' in config;
}
