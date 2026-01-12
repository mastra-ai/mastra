import type { DynamoDBTtlConfig, DynamoDBTtlEntityName, DynamoDBEntityTtlConfig } from './index';

/**
 * Calculate TTL value for a given entity type.
 *
 * DynamoDB TTL is a Unix timestamp (seconds since epoch) that indicates when an item
 * should be automatically deleted. AWS processes TTL deletions typically within 48 hours
 * after the item expires.
 *
 * @param entityName - The entity type (e.g., 'thread', 'message')
 * @param ttlConfig - The TTL configuration for all entities
 * @param customTtlSeconds - Optional override for the TTL duration
 * @returns The TTL Unix timestamp, or undefined if TTL is not enabled
 */
export function calculateTtl(
  entityName: DynamoDBTtlEntityName,
  ttlConfig?: DynamoDBTtlConfig,
  customTtlSeconds?: number,
): number | undefined {
  const entityConfig = ttlConfig?.[entityName];

  // If TTL is not configured or not enabled for this entity, return undefined
  if (!entityConfig?.enabled) {
    return undefined;
  }

  // Use custom TTL if provided, otherwise use the default from config
  const ttlSeconds = customTtlSeconds ?? entityConfig.defaultTtlSeconds;

  // If no TTL duration is specified, return undefined
  if (ttlSeconds === undefined || ttlSeconds <= 0) {
    return undefined;
  }

  // Calculate TTL as Unix timestamp (current time + TTL duration)
  // DynamoDB TTL requires epoch seconds (not milliseconds)
  return Math.floor(Date.now() / 1000) + ttlSeconds;
}

/**
 * Get the TTL attribute name for a given entity type.
 *
 * @param entityName - The entity type (e.g., 'thread', 'message')
 * @param ttlConfig - The TTL configuration for all entities
 * @returns The attribute name to use for TTL (default: 'ttl')
 */
export function getTtlAttributeName(entityName: DynamoDBTtlEntityName, ttlConfig?: DynamoDBTtlConfig): string {
  const entityConfig = ttlConfig?.[entityName];
  return entityConfig?.attributeName ?? 'ttl';
}

/**
 * Get the TTL configuration for a specific entity type.
 *
 * @param entityName - The entity type (e.g., 'thread', 'message')
 * @param ttlConfig - The TTL configuration for all entities
 * @returns The entity TTL config, or undefined if not configured
 */
export function getEntityTtlConfig(
  entityName: DynamoDBTtlEntityName,
  ttlConfig?: DynamoDBTtlConfig,
): DynamoDBEntityTtlConfig | undefined {
  return ttlConfig?.[entityName];
}

/**
 * Check if TTL is enabled for a given entity type.
 *
 * @param entityName - The entity type (e.g., 'thread', 'message')
 * @param ttlConfig - The TTL configuration for all entities
 * @returns true if TTL is enabled for this entity
 */
export function isTtlEnabled(entityName: DynamoDBTtlEntityName, ttlConfig?: DynamoDBTtlConfig): boolean {
  return ttlConfig?.[entityName]?.enabled === true;
}

/**
 * Add TTL attribute to a record if TTL is enabled for the entity type.
 *
 * @param record - The record to add TTL to
 * @param entityName - The entity type (e.g., 'thread', 'message')
 * @param ttlConfig - The TTL configuration for all entities
 * @param customTtlSeconds - Optional override for the TTL duration
 * @returns The record with TTL attribute added (if enabled)
 */
export function addTtlToRecord<T extends Record<string, any>>(
  record: T,
  entityName: DynamoDBTtlEntityName,
  ttlConfig?: DynamoDBTtlConfig,
  customTtlSeconds?: number,
): T {
  const ttlValue = calculateTtl(entityName, ttlConfig, customTtlSeconds);

  if (ttlValue === undefined) {
    return record;
  }

  const attributeName = getTtlAttributeName(entityName, ttlConfig);

  return {
    ...record,
    [attributeName]: ttlValue,
  };
}
