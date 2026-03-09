import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Service } from 'electrodb';
import { getElectroDbService } from '../../entities';
import type { DynamoDBTtlConfig } from '../index';

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing ElectroDB service
 * 2. Config to create a new service internally
 */
export type DynamoDBDomainConfig = DynamoDBDomainServiceConfig | DynamoDBDomainRestConfig;

/**
 * Pass an existing ElectroDB service
 */
export interface DynamoDBDomainServiceConfig {
  service: Service<Record<string, any>>;
  /**
   * TTL configuration for automatic data expiration.
   */
  ttl?: DynamoDBTtlConfig;
}

/**
 * Pass config to create a new ElectroDB service internally
 */
export interface DynamoDBDomainRestConfig {
  region?: string;
  tableName: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /**
   * TTL configuration for automatic data expiration.
   */
  ttl?: DynamoDBTtlConfig;
}

/**
 * Resolved DynamoDB config with service and TTL settings.
 */
export interface ResolvedDynamoDBConfig {
  service: Service<Record<string, any>>;
  ttl?: DynamoDBTtlConfig;
}

/**
 * Resolves DynamoDBDomainConfig to an ElectroDB service and TTL config.
 * Handles creating a new service if config is provided.
 */
export function resolveDynamoDBConfig(config: DynamoDBDomainConfig): ResolvedDynamoDBConfig {
  // Existing service
  if ('service' in config) {
    return { service: config.service, ttl: config.ttl };
  }

  // Config to create new service
  const dynamoClient = new DynamoDBClient({
    region: config.region || 'us-east-1',
    endpoint: config.endpoint,
    credentials: config.credentials,
  });

  const client = DynamoDBDocumentClient.from(dynamoClient);
  return {
    service: getElectroDbService(client, config.tableName),
    ttl: config.ttl,
  };
}
