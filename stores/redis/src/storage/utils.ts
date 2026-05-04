import type { RedisClient, RedisConfig } from './types';

export function isClientConfig(config: RedisConfig): config is RedisConfig & { client: RedisClient } {
  return 'client' in config;
}

export function isConnectionStringConfig(config: RedisConfig): config is RedisConfig & { connectionString: string } {
  return 'connectionString' in config;
}
