import { createHash } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import type { Pool } from 'oracledb';

import { OraclePoolManager } from '../shared/connection';
import { normalizeIdentifier } from '../vector/identifiers';
import { OracleDB, filterIndexesForTables } from './db';
import type { OracleCreateIndexOptions } from './db';
import { AgentsOracle } from './domains/agents';
import { MCPClientsOracle } from './domains/mcp-clients';
import { MemoryOracle } from './domains/memory';
import { ObservabilityOracle } from './domains/observability';
import { ScorerDefinitionsOracle } from './domains/scorer-definitions';
import { ScoresOracle } from './domains/scores';
import { WorkflowsOracle } from './domains/workflows';
import { OracleMigrationRegistry } from './migrations';
import type { OracleMigration, OracleMigrationRecord, OracleMigrationResult } from './migrations';
import type { OracleStoreConfig } from './types';

const STORE_NAME = 'ORACLEDB';
const DOMAIN_SCHEMA_VERSIONS: Record<string, number> = {
  R001_MEMORY_SCHEMA: 1,
  R002_WORKFLOWS_SCHEMA: 1,
  R003_OBSERVABILITY_SCHEMA: 1,
  R004_SCORES_SCHEMA: 1,
  R005_SCORER_DEFINITIONS_SCHEMA: 1,
  R006_MCP_CLIENTS_SCHEMA: 1,
  R007_AGENTS_SCHEMA: 1,
};

export class OracleStore extends MastraCompositeStore {
  private readonly poolManager: OraclePoolManager;
  private readonly ownsPoolManager: boolean;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: OracleCreateIndexOptions[];
  private readonly dbClient: OracleDB;
  private readonly migrationRegistry: OracleMigrationRegistry;
  private isInitialized = false;
  private initPromise?: Promise<void>;
  private migrationPromise?: Promise<OracleMigrationResult[]>;

  stores: StorageDomains;

  constructor(config: OracleStoreConfig) {
    try {
      super({ id: config.id, name: 'OracleStore', disableInit: config.disableInit });
      this.schemaName = config.schemaName ? normalizeIdentifier(config.schemaName, 'schema name') : undefined;
      this.skipDefaultIndexes = config.skipDefaultIndexes;
      this.indexes = config.indexes;
      this.poolManager = config.poolManager ?? new OraclePoolManager(config);
      this.ownsPoolManager = !config.poolManager;
      this.dbClient = new OracleDB({ poolManager: this.poolManager, schemaName: this.schemaName });
      this.migrationRegistry = new OracleMigrationRegistry({
        db: this.dbClient,
        tableName: config.migrationTableName,
      });

      const domainConfig = {
        poolManager: this.poolManager,
        schemaName: this.schemaName,
        messageBatchSize: config.messageBatchSize,
        skipDefaultIndexes: config.skipDefaultIndexes,
        indexes: config.indexes,
        vectorRegistryTableName: config.vectorRegistryTableName
          ? normalizeIdentifier(config.vectorRegistryTableName, 'vector registry table name')
          : undefined,
      };

      this.stores = {
        memory: new MemoryOracle(domainConfig),
        workflows: new WorkflowsOracle(domainConfig),
        observability: new ObservabilityOracle(domainConfig),
        scores: new ScoresOracle(domainConfig),
        scorerDefinitions: new ScorerDefinitionsOracle(domainConfig),
        mcpClients: new MCPClientsOracle(domainConfig),
        agents: new AgentsOracle(domainConfig),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId(STORE_NAME, 'INITIALIZATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { schemaName: config.schemaName ?? '' },
        },
        error,
      );
    }
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.runMigrationsOnce(false).then(() => undefined);
    return this.initPromise;
  }

  async migrate(): Promise<OracleMigrationResult[]> {
    // If an init() is already in flight, let it settle first so a concurrent
    // migrate() still gets its own forced (forceRepeatable: true) run instead
    // of coalescing into the unforced init promise. runMigrations()'s finally
    // block clears migrationPromise/initPromise on settle, so this always
    // starts a fresh forced run afterward.
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.runMigrationsOnce(true);
  }

  private async runMigrationsOnce(forceRepeatable: boolean): Promise<OracleMigrationResult[]> {
    if (this.migrationPromise) return this.migrationPromise;

    this.migrationPromise = this.runMigrations(forceRepeatable);
    return this.migrationPromise;
  }

  async listMigrations(): Promise<OracleMigrationRecord[]> {
    return this.migrationRegistry.list();
  }

  private async runMigrations(forceRepeatable: boolean): Promise<OracleMigrationResult[]> {
    try {
      const results = await this.migrationRegistry.run(this.storageMigrations(), { forceRepeatable });
      this.isInitialized = true;
      return results;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId(STORE_NAME, 'MIGRATION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    } finally {
      this.migrationPromise = undefined;
      this.initPromise = undefined;
    }
  }

  private storageMigrations(): OracleMigration[] {
    const repeatable = (
      id: string,
      name: string,
      description: string,
      managedTables: readonly string[],
      run: () => Promise<void>,
    ): OracleMigration => ({
      id,
      name,
      kind: 'repeatable',
      description,
      checksum: this.domainMigrationChecksum({ id, name, description, managedTables }),
      run,
    });

    return [
      repeatable(
        'R001_MEMORY_SCHEMA',
        'Memory domain schema',
        'Creates or updates Oracle tables and indexes for threads, messages, resources, working memory, and observational memory.',
        MemoryOracle.MANAGED_TABLES,
        async () => {
          await this.stores.memory?.init();
        },
      ),
      repeatable(
        'R002_WORKFLOWS_SCHEMA',
        'Workflow domain schema',
        'Creates or updates Oracle workflow snapshot tables for durable workflow state.',
        WorkflowsOracle.MANAGED_TABLES,
        async () => {
          await this.stores.workflows?.init();
        },
      ),
      repeatable(
        'R003_OBSERVABILITY_SCHEMA',
        'Observability domain schema',
        'Creates or updates Oracle spans and log event tables used by Mastra observability.',
        ObservabilityOracle.MANAGED_TABLES,
        async () => {
          await this.stores.observability?.init();
        },
      ),
      repeatable(
        'R004_SCORES_SCHEMA',
        'Scores domain schema',
        'Creates or updates Oracle scoring and evaluation result tables.',
        ScoresOracle.MANAGED_TABLES,
        async () => {
          await this.stores.scores?.init();
        },
      ),
      repeatable(
        'R005_SCORER_DEFINITIONS_SCHEMA',
        'Scorer definitions domain schema',
        'Creates or updates Oracle scorer definition registry tables and indexes.',
        ScorerDefinitionsOracle.MANAGED_TABLES,
        async () => {
          await this.stores.scorerDefinitions?.init();
        },
      ),
      repeatable(
        'R006_MCP_CLIENTS_SCHEMA',
        'MCP clients domain schema',
        'Creates or updates Oracle MCP client registry tables and indexes.',
        MCPClientsOracle.MANAGED_TABLES,
        async () => {
          await this.stores.mcpClients?.init();
        },
      ),
      repeatable(
        'R007_AGENTS_SCHEMA',
        'Agents domain schema',
        'Creates or updates Oracle agent registry tables and indexes.',
        AgentsOracle.MANAGED_TABLES,
        async () => {
          await this.stores.agents?.init();
        },
      ),
    ];
  }

  private domainMigrationChecksum(input: {
    id: string;
    name: string;
    description: string;
    managedTables: readonly string[];
  }): string {
    const indexes = filterIndexesForTables(this.indexes, input.managedTables);

    return createHash('sha256')
      .update(
        stableStringify({
          id: input.id,
          name: input.name,
          kind: 'repeatable',
          description: input.description,
          schemaVersion: DOMAIN_SCHEMA_VERSIONS[input.id] ?? 1,
          managedTables: [...input.managedTables],
          indexConfig: {
            skipDefaultIndexes: this.skipDefaultIndexes === true,
            indexes,
          },
        }),
      )
      .digest('hex')
      .toUpperCase();
  }

  async getPool(): Promise<Pool> {
    return this.poolManager.getPool();
  }

  getPoolManager(): OraclePoolManager {
    return this.poolManager;
  }

  get db(): OracleDB {
    return this.dbClient;
  }

  async disconnect(): Promise<void> {
    if (this.ownsPoolManager) {
      await this.poolManager.close();
    }
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}

export { OracleDB } from './db';
export { AgentsOracle } from './domains/agents';
export { MCPClientsOracle } from './domains/mcp-clients';
export { MemoryOracle } from './domains/memory';
export { ObservabilityOracle } from './domains/observability';
export { ScorerDefinitionsOracle } from './domains/scorer-definitions';
export { ScoresOracle } from './domains/scores';
export { WorkflowsOracle } from './domains/workflows';
export { DEFAULT_ORACLE_MIGRATIONS_TABLE, OracleMigrationRegistry, oracleMigrationTableSql } from './migrations';
export type { OracleMigration, OracleMigrationRecord, OracleMigrationResult, OracleMigrationRunOptions } from './migrations';
export type { OracleStoreConfig } from './types';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);

  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}
