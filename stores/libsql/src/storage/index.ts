import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import type { StorageDomains } from '@mastra/core/storage';
import { MastraCompositeStore } from '@mastra/core/storage';

import { AgentsLibSQL } from './domains/agents';
import { BackgroundTasksLibSQL } from './domains/background-tasks';
import { BlobsLibSQL } from './domains/blobs';
import { ChannelsLibSQL } from './domains/channels';
import { DatasetsLibSQL } from './domains/datasets';
import { ExperimentsLibSQL } from './domains/experiments';
import { MCPClientsLibSQL } from './domains/mcp-clients';
import { MCPServersLibSQL } from './domains/mcp-servers';
import { MemoryLibSQL } from './domains/memory';
import { ObservabilityLibSQL } from './domains/observability';
import { PromptBlocksLibSQL } from './domains/prompt-blocks';
import { SchedulesLibSQL } from './domains/schedules';
import { ScorerDefinitionsLibSQL } from './domains/scorer-definitions';
import { ScoresLibSQL } from './domains/scores';
import { SkillsLibSQL } from './domains/skills';
import { WorkflowsLibSQL } from './domains/workflows';
import { WorkspacesLibSQL } from './domains/workspaces';

// Export domain classes for direct use with MastraStorage composition
export {
  AgentsLibSQL,
  BackgroundTasksLibSQL,
  BlobsLibSQL,
  ChannelsLibSQL,
  DatasetsLibSQL,
  ExperimentsLibSQL,
  MCPClientsLibSQL,
  MCPServersLibSQL,
  MemoryLibSQL,
  ObservabilityLibSQL,
  PromptBlocksLibSQL,
  SchedulesLibSQL,
  ScorerDefinitionsLibSQL,
  ScoresLibSQL,
  SkillsLibSQL,
  WorkflowsLibSQL,
  WorkspacesLibSQL,
};
export type { LibSQLDomainConfig } from './db';

export type LibSQLStorageDomain = keyof StorageDomains;

/**
 * Base configuration options shared across LibSQL configurations
 */
export type LibSQLBaseConfig = {
  id: string;
  /**
   * Maximum number of retries for write operations if an SQLITE_BUSY error occurs.
   * @default 5
   */
  maxRetries?: number;
  /**
   * Initial backoff time in milliseconds for retrying write operations on SQLITE_BUSY.
   * The backoff time will double with each retry (exponential backoff).
   * @default 100
   */
  initialBackoffMs?: number;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new LibSQLStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new LibSQLStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
};

export type LibSQLConfig =
  | (LibSQLBaseConfig & {
      url: string;
      authToken?: string;
    })
  | (LibSQLBaseConfig & {
      client: Client;
    });

/**
 * LibSQL/Turso storage adapter for Mastra.
 *
 * Access domain-specific storage via `getStore()`:
 *
 * @example
 * ```typescript
 * const storage = new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' });
 *
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 * ```
 */
export class LibSQLStore extends MastraCompositeStore {
  private client: Client;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly pragmasReady: Promise<void>;
  private readonly isLocalDb: boolean;

  stores: StorageDomains;

  constructor(config: LibSQLConfig) {
    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error('LibSQLStore: id must be provided and cannot be empty.');
    }
    super({ id: config.id, name: `LibSQLStore`, disableInit: config.disableInit });

    this.maxRetries = config.maxRetries ?? 5;
    this.initialBackoffMs = config.initialBackoffMs ?? 100;

    if ('url' in config) {
      // need to re-init every time for in memory dbs or the tables might not exist
      if (config.url.includes(':memory:')) {
        this.shouldCacheInit = false;
      }

      this.client = createClient({
        url: config.url,
        ...(config.authToken ? { authToken: config.authToken } : {}),
      });

      this.isLocalDb = config.url.startsWith('file:') || config.url.includes(':memory:');
      this.pragmasReady = this.isLocalDb ? this.applyLocalPragmas() : Promise.resolve();
    } else {
      this.client = config.client;
      this.isLocalDb = false;
      this.pragmasReady = Promise.resolve();
    }

    const domainConfig = {
      client: this.client,
      maxRetries: this.maxRetries,
      initialBackoffMs: this.initialBackoffMs,
    };

    const scores = new ScoresLibSQL(domainConfig);
    const workflows = new WorkflowsLibSQL(domainConfig);
    const memory = new MemoryLibSQL(domainConfig);
    const observability = new ObservabilityLibSQL(domainConfig);
    const agents = new AgentsLibSQL(domainConfig);
    const channels = new ChannelsLibSQL(domainConfig);
    const datasets = new DatasetsLibSQL(domainConfig);
    const experiments = new ExperimentsLibSQL(domainConfig);
    const promptBlocks = new PromptBlocksLibSQL(domainConfig);
    const scorerDefinitions = new ScorerDefinitionsLibSQL(domainConfig);
    const mcpClients = new MCPClientsLibSQL(domainConfig);
    const mcpServers = new MCPServersLibSQL(domainConfig);
    const workspaces = new WorkspacesLibSQL(domainConfig);
    const skills = new SkillsLibSQL(domainConfig);
    const blobs = new BlobsLibSQL(domainConfig);
    const backgroundTasks = new BackgroundTasksLibSQL(domainConfig);
    const schedules = new SchedulesLibSQL(domainConfig);

    this.stores = {
      scores,
      workflows,
      memory,
      observability,
      agents,
      channels,
      datasets,
      experiments,
      promptBlocks,
      scorerDefinitions,
      mcpClients,
      mcpServers,
      workspaces,
      skills,
      blobs,
      backgroundTasks,
      schedules,
    };
  }

  private async applyLocalPragmas(): Promise<void> {
    const pragmas = [
      ['journal_mode=WAL', 'PRAGMA journal_mode=WAL;'],
      ['busy_timeout=5000', 'PRAGMA busy_timeout=5000;'],
      ['synchronous=NORMAL', 'PRAGMA synchronous=NORMAL;'],
      ['temp_store=MEMORY', 'PRAGMA temp_store=MEMORY;'],
      ['cache_size=-128000', 'PRAGMA cache_size=-128000;'],
      ['mmap_size=1073741824', 'PRAGMA mmap_size=1073741824;'],
    ] as const;

    for (const [label, sql] of pragmas) {
      try {
        await this.client.execute(sql);
        this.logger.debug(`LibSQLStore: PRAGMA ${label} set.`);
      } catch (err) {
        this.logger.warn(`LibSQLStore: Failed to set PRAGMA ${label}.`, err);
      }
    }
  }

  private getDomainsToInit(): LibSQLStorageDomain[] {
    return [
      'memory',
      'workflows',
      'scores',
      'observability',
      'agents',
      'datasets',
      'experiments',
      'promptBlocks',
      'scorerDefinitions',
      'mcpClients',
      'mcpServers',
      'workspaces',
      'skills',
      'blobs',
      'backgroundTasks',
      'schedules',
      'channels',
    ];
  }

  private async initDomainsSequentially(): Promise<boolean> {
    for (const domain of this.getDomainsToInit()) {
      await this.stores[domain]?.init();
    }
    return true;
  }

  private async initDomainsInParallel(): Promise<boolean> {
    await Promise.all(
      this.getDomainsToInit()
        .map(domain => this.stores[domain]?.init())
        .filter(Boolean),
    );
    return true;
  }

  override async init(): Promise<void> {
    await this.pragmasReady;

    if (!this.isLocalDb) {
      if (this.shouldCacheInit) {
        if (this.hasInitialized) {
          await this.hasInitialized;
          return;
        }

        this.hasInitialized = this.initDomainsInParallel();
        await this.hasInitialized;
        return;
      }

      await this.initDomainsInParallel();
      return;
    }

    // Cache and coalesce local file DB initialization to avoid duplicate DDL.
    if (this.shouldCacheInit) {
      if (this.hasInitialized) {
        await this.hasInitialized;
        return;
      }

      this.hasInitialized = this.initDomainsSequentially();
      await this.hasInitialized;
      return;
    }

    await this.initDomainsSequentially();
  }
}

export { LibSQLStore as DefaultStorage };
