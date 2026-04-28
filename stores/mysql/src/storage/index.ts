import { MastraError, ErrorCategory, ErrorDomain } from '@mastra/core/error';
import { MastraCompositeStore } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import { createPool } from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';

import { AgentsMySQL } from './domains/agents';
import { BlobsMySQL } from './domains/blobs';
import { DatasetsMySQL } from './domains/datasets';
import { ExperimentsMySQL } from './domains/experiments';
import { MCPClientsMySQL } from './domains/mcp-clients';
import { MCPServersMySQL } from './domains/mcp-servers';
import { MemoryMySQL } from './domains/memory';
import { ObservabilityMySQL } from './domains/observability';
import { StoreOperationsMySQL } from './domains/operations';
import { PromptBlocksMySQL } from './domains/prompt-blocks';
import { ScorerDefinitionsMySQL } from './domains/scorer-definitions';
import { ScoresMySQL } from './domains/scores';
import { SkillsMySQL } from './domains/skills';
import { WorkflowsMySQL } from './domains/workflows';
import { WorkspacesMySQL } from './domains/workspaces';

// Export domain classes for direct use with MastraStorage composition
export {
  AgentsMySQL,
  BlobsMySQL,
  DatasetsMySQL,
  ExperimentsMySQL,
  MCPClientsMySQL,
  MCPServersMySQL,
  MemoryMySQL,
  ObservabilityMySQL,
  StoreOperationsMySQL,
  PromptBlocksMySQL,
  ScorerDefinitionsMySQL,
  ScoresMySQL,
  SkillsMySQL,
  WorkflowsMySQL,
  WorkspacesMySQL,
};

export type MySQLStoreConfig =
  | {
      connectionString: string;
      database?: string;
      max?: number;
      ssl?: boolean | Record<string, unknown>;
    }
  | {
      host: string;
      port?: number;
      user: string;
      password?: string;
      database: string;
      ssl?: boolean | Record<string, unknown>;
      max?: number;
      waitForConnections?: boolean;
      queueLimit?: number;
    };

function validateConfig(config: MySQLStoreConfig): void {
  if ('connectionString' in config) {
    if (!config.connectionString || typeof config.connectionString !== 'string') {
      throw new Error('MySQLStore: connectionString must be a non-empty string.');
    }
    return;
  }

  const required: Array<keyof typeof config> = ['host', 'user', 'database'];
  for (const key of required) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`MySQLStore: ${key} must be provided and cannot be empty.`);
    }
  }

  if ('password' in config && config.password !== undefined) {
    if (typeof config.password !== 'string') {
      throw new Error('MySQLStore: password must be a string if provided.');
    }
  }
}

function createMySQLPool(config: MySQLStoreConfig): { pool: Pool; database?: string } {
  if ('connectionString' in config) {
    const { options } = parseConnectionString(config.connectionString, config);
    return { pool: createPool(options), database: options.database };
  }

  const options: PoolOptions = {
    host: config.host,
    port: config.port ?? 3306,
    user: config.user,
    database: config.database,
    connectionLimit: config.max ?? 10,
    waitForConnections: config.waitForConnections ?? true,
    queueLimit: config.queueLimit ?? 0,
    dateStrings: true,
  };

  if (config.password !== undefined) {
    options.password = config.password;
  }

  if ('ssl' in config && config.ssl) {
    options.ssl = typeof config.ssl === 'boolean' ? {} : (config.ssl as PoolOptions['ssl']);
  }

  return { pool: createPool(options), database: options.database };
}

function parseConnectionString(
  connectionString: string,
  overrides: Extract<MySQLStoreConfig, { connectionString: string }>,
): { options: PoolOptions } {
  const url = new URL(connectionString);

  const databaseFromUrl = url.pathname.replace(/^\//, '') || undefined;

  const base: PoolOptions = {
    host: url.hostname || 'localhost',
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: overrides.database ?? databaseFromUrl,
    connectionLimit: overrides.max ?? 10,
    waitForConnections: true,
    queueLimit: 0,
    dateStrings: true,
  };

  if (url.searchParams.has('waitForConnections')) {
    base.waitForConnections = url.searchParams.get('waitForConnections') === 'true';
  }
  if (url.searchParams.has('queueLimit')) {
    const queueLimit = Number(url.searchParams.get('queueLimit'));
    if (!Number.isNaN(queueLimit)) {
      base.queueLimit = queueLimit;
    }
  }
  if (url.searchParams.has('connectionLimit')) {
    const connectionLimit = Number(url.searchParams.get('connectionLimit'));
    if (!Number.isNaN(connectionLimit)) {
      base.connectionLimit = connectionLimit;
    }
  }
  if (url.searchParams.has('dateStrings')) {
    base.dateStrings = url.searchParams.get('dateStrings') === 'true';
  }

  let sslParam: unknown = overrides.ssl ?? url.searchParams.get('ssl') ?? undefined;
  if (typeof sslParam === 'string') {
    const trimmed = sslParam.trim();
    const lowered = trimmed.toLowerCase();
    if (['false', '0', 'off', ''].includes(lowered)) {
      sslParam = undefined;
    } else if (['true', '1', 'on'].includes(lowered)) {
      sslParam = {};
    } else if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        sslParam = JSON.parse(trimmed);
      } catch {
        sslParam = undefined;
      }
    }
  }
  if (sslParam && typeof sslParam === 'object') {
    base.ssl = sslParam as PoolOptions['ssl'];
  }

  return { options: base };
}

export class MySQLStore extends MastraCompositeStore {
  private pool: Pool;

  stores: StorageDomains;

  constructor(config: MySQLStoreConfig & { id?: string; disableInit?: boolean }) {
    super({ id: config.id ?? 'mysql', name: 'MySQLStore', disableInit: config.disableInit });
    validateConfig(config);
    const { pool, database } = createMySQLPool(config);
    this.pool = pool;

    const operations = new StoreOperationsMySQL({ pool: this.pool, database });

    const memory = new MemoryMySQL({ pool: this.pool, operations });
    const workflows = new WorkflowsMySQL({ operations, pool: this.pool });
    const scores = new ScoresMySQL({ pool: this.pool, operations });
    const observability = new ObservabilityMySQL({ operations });
    const agents = new AgentsMySQL({ pool: this.pool, operations });
    const datasets = new DatasetsMySQL({ pool: this.pool, operations });
    const experiments = new ExperimentsMySQL({ pool: this.pool, operations });
    const promptBlocks = new PromptBlocksMySQL({ pool: this.pool, operations });
    const scorerDefinitions = new ScorerDefinitionsMySQL({ pool: this.pool, operations });
    const mcpClients = new MCPClientsMySQL({ pool: this.pool, operations });
    const mcpServers = new MCPServersMySQL({ pool: this.pool, operations });
    const workspaces = new WorkspacesMySQL({ pool: this.pool, operations });
    const skills = new SkillsMySQL({ pool: this.pool, operations });
    const blobs = new BlobsMySQL({ pool: this.pool, operations });

    this.stores = {
      memory,
      workflows,
      scores,
      observability,
      agents,
      datasets,
      experiments,
      promptBlocks,
      scorerDefinitions,
      mcpClients,
      mcpServers,
      workspaces,
      skills,
      blobs,
    };
  }

  async init(): Promise<void> {
    try {
      const connection = await this.pool.getConnection();
      connection.release();
      await super.init();
    } catch (error) {
      throw new MastraError(
        {
          id: 'MYSQL_STORE_INIT_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
