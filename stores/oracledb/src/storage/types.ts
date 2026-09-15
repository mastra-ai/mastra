import type { MastraCompositeStoreConfig } from '@mastra/core/storage';
import type { OracleConnectionConfig, OraclePoolManager } from '../shared/connection';
import type { OracleCreateIndexOptions } from './db';

// Public store config extends the shared Oracle connection contract and adds
// storage-only controls for initialization, batching, migrations, and indexes.
export interface OracleStoreConfig extends OracleConnectionConfig, Pick<MastraCompositeStoreConfig, 'disableInit'> {
  id: string;
  schemaName?: string;
  poolManager?: OraclePoolManager;
  /**
   * Number of messages to send per Oracle executeMany call. The full
   * saveMessages operation still commits once at the transaction boundary.
   */
  messageBatchSize?: number;
  /**
   * When true, default performance indexes are not created during initialization.
   * Use this when DBAs manage indexes separately or custom indexes replace the defaults.
   */
  skipDefaultIndexes?: boolean;
  /**
   * Oracle-native custom indexes to create during initialization. Indexes are
   * routed to the storage domain that owns the target table.
   */
  indexes?: OracleCreateIndexOptions[];
  /**
   * Oracle table used to track storage schema migrations. Override only when
   * multiple logical Mastra deployments share the same Oracle schema.
   */
  migrationTableName?: string;
  /**
   * OracleVector registry table used to discover semantic-recall vector tables
   * during message/thread deletion. Set this to the same value as
   * OracleVector.registryTableName when that option is customized.
   */
  vectorRegistryTableName?: string;
}

// Each storage domain receives the same normalized Oracle runtime context from
// OracleStore so domains stay isolated but still share one connection pool.
export interface OracleDomainConfig {
  poolManager: OraclePoolManager;
  schemaName?: string;
  messageBatchSize?: number;
  skipDefaultIndexes?: boolean;
  indexes?: OracleCreateIndexOptions[];
  vectorRegistryTableName?: string;
}

export type { OracleCreateIndexOptions, OracleIndexType } from './db';
