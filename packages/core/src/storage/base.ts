import { MastraBase } from '../base';

import type {
  AgentsStorage,
  PromptBlocksStorage,
  ScorerDefinitionsStorage,
  MCPClientsStorage,
  MCPServersStorage,
  WorkspacesStorage,
  SkillsStorage,
  ScoresStorage,
  WorkflowsStorage,
  MemoryStorage,
  ObservabilityStorage,
  BlobStore,
  DatasetsStorage,
  ExperimentsStorage,
} from './domains';

export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
  datasets?: DatasetsStorage;
  experiments?: ExperimentsStorage;
  promptBlocks?: PromptBlocksStorage;
  scorerDefinitions?: ScorerDefinitionsStorage;
  mcpClients?: MCPClientsStorage;
  mcpServers?: MCPServersStorage;
  workspaces?: WorkspacesStorage;
  skills?: SkillsStorage;
  blobs?: BlobStore;
};

/**
 * Normalizes perPage input for pagination queries.
 *
 * @param perPageInput - The raw perPage value from the user
 * @param defaultValue - The default perPage value to use when undefined (typically 40 for messages, 100 for threads)
 * @returns A numeric perPage value suitable for queries (false becomes MAX_SAFE_INTEGER)
 * @throws Error if perPage is a negative number
 */
export function normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
  if (perPageInput === false) {
    return Number.MAX_SAFE_INTEGER; // Get all results
  } else if (perPageInput === 0) {
    return 0; // Return zero results
  } else if (typeof perPageInput === 'number' && perPageInput > 0) {
    return perPageInput; // Valid positive number
  } else if (typeof perPageInput === 'number' && perPageInput < 0) {
    throw new Error('perPage must be >= 0');
  }
  // For undefined, use default
  return defaultValue;
}

/**
 * Calculates pagination offset and prepares perPage value for response.
 * When perPage is false (fetch all), offset is always 0 regardless of page.
 *
 * @param page - The page number (0-indexed)
 * @param perPageInput - The original perPage input (number, false for all, or undefined)
 * @param normalizedPerPage - The normalized perPage value (from normalizePerPage)
 * @returns Object with offset for query and perPage for response
 */
export function calculatePagination(
  page: number,
  perPageInput: number | false | undefined,
  normalizedPerPage: number,
): { offset: number; perPage: number | false } {
  return {
    offset: perPageInput === false ? 0 : page * normalizedPerPage,
    perPage: perPageInput === false ? false : normalizedPerPage,
  };
}

/**
 * Configuration for individual domain overrides.
 * Each domain can be sourced from a different storage adapter.
 */
export type MastraStorageDomains = Partial<StorageDomains>;

/**
 * Configuration options for MastraCompositeStore.
 *
 * Can be used in two ways:
 * 1. By store implementations: `{ id, name, disableInit? }` - stores set `this.stores` directly
 * 2. For composition: `{ id, default?, domains?, disableInit? }` - compose domains from multiple stores
 */
export interface MastraCompositeStoreConfig {
  /**
   * Unique identifier for this storage instance.
   */
  id: string;

  /**
   * Name of the storage adapter (used for logging).
   * Required for store implementations extending MastraCompositeStore.
   */
  name?: string;

  /**
   * Default storage adapter to use for domains not explicitly specified.
   * If provided, domains from this storage will be used as fallbacks.
   */
  default?: MastraCompositeStore;

  /**
   * Individual domain overrides. Each domain can come from a different storage adapter.
   * These take precedence over the default storage.
   *
   * @example
   * ```typescript
   * domains: {
   *   memory: pgStore.stores?.memory,
   *   workflows: libsqlStore.stores?.workflows,
   * }
   * ```
   */
  domains?: MastraStorageDomains;

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
   * const storage = new PostgresStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new PostgresStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
}

/**
 * Base class for all Mastra storage adapters.
 *
 * Can be used in two ways:
 *
 * 1. **Extended by store implementations** (PostgresStore, LibSQLStore, etc.):
 *    Store implementations extend this class and set `this.stores` with their domain implementations.
 *
 * 2. **Directly instantiated for composition**:
 *    Compose domains from multiple storage backends using `default` and `domains` options.
 *
 * All domain-specific operations should be accessed through `getStore()`:
 *
 * @example
 * ```typescript
 * // Composition: mix domains from different stores
 * const storage = new MastraCompositeStore({
 *   id: 'composite',
 *   default: pgStore,
 *   domains: {
 *     memory: libsqlStore.stores?.memory,
 *   },
 * });
 *
 * // Access domains
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 * ```
 */
export class MastraCompositeStore extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;

  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   */
  disableInit: boolean = false;

  constructor(config: MastraCompositeStoreConfig) {
    const name = config.name ?? 'MastraCompositeStore';

    if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
      throw new Error(`${name}: id must be provided and cannot be empty.`);
    }

    super({
      component: 'STORAGE',
      name,
    });

    this.id = config.id;
    this.disableInit = config.disableInit ?? false;

    // If composition config is provided (default or domains), compose the stores
    if (config.default || config.domains) {
      const defaultStores = config.default?.stores;
      const domainOverrides = config.domains ?? {};

      // Validate that at least one storage source is provided
      const hasDefaultDomains = defaultStores && Object.values(defaultStores).some(v => v !== undefined);
      const hasOverrideDomains = Object.values(domainOverrides).some(v => v !== undefined);

      if (!hasDefaultDomains && !hasOverrideDomains) {
        throw new Error(
          'MastraCompositeStore requires at least one storage source. Provide either a default storage with domains or domain overrides.',
        );
      }

      // Build the composed stores object
      // Domain overrides take precedence over default storage
      this.stores = {
        memory: domainOverrides.memory ?? defaultStores?.memory,
        workflows: domainOverrides.workflows ?? defaultStores?.workflows,
        scores: domainOverrides.scores ?? defaultStores?.scores,
        observability: domainOverrides.observability ?? defaultStores?.observability,
        agents: domainOverrides.agents ?? defaultStores?.agents,
        datasets: domainOverrides.datasets ?? defaultStores?.datasets,
        experiments: domainOverrides.experiments ?? defaultStores?.experiments,
        promptBlocks: domainOverrides.promptBlocks ?? defaultStores?.promptBlocks,
        scorerDefinitions: domainOverrides.scorerDefinitions ?? defaultStores?.scorerDefinitions,
        mcpClients: domainOverrides.mcpClients ?? defaultStores?.mcpClients,
        mcpServers: domainOverrides.mcpServers ?? defaultStores?.mcpServers,
        workspaces: domainOverrides.workspaces ?? defaultStores?.workspaces,
        skills: domainOverrides.skills ?? defaultStores?.skills,
      } as StorageDomains;
    }
    // Otherwise, subclasses set stores themselves
  }

  /**
   * Get a domain-specific storage interface.
   *
   * @param storeName - The name of the domain to access ('memory', 'workflows', 'scores', 'observability', 'agents')
   * @returns The domain storage interface, or undefined if not available
   *
   * @example
   * ```typescript
   * const memory = await storage.getStore('memory');
   * if (memory) {
   *   await memory.saveThread({ thread });
   * }
   * ```
   */
  async getStore<K extends keyof StorageDomains>(storeName: K): Promise<StorageDomains[K] | undefined> {
    return this.stores?.[storeName];
  }

  /**
   * Initialize all domain stores.
   * This creates necessary tables, indexes, and performs any required migrations.
   */
  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    // Initialize all domain stores
    const initTasks: Promise<void>[] = [];

    if (this.stores?.memory) {
      initTasks.push(this.stores.memory.init());
    }

    if (this.stores?.workflows) {
      initTasks.push(this.stores.workflows.init());
    }

    if (this.stores?.scores) {
      initTasks.push(this.stores.scores.init());
    }

    if (this.stores?.observability) {
      initTasks.push(this.stores.observability.init());
    }

    if (this.stores?.agents) {
      initTasks.push(this.stores.agents.init());
    }

    if (this.stores?.datasets) {
      initTasks.push(this.stores.datasets.init());
    }

    if (this.stores?.experiments) {
      initTasks.push(this.stores.experiments.init());
    }

    if (this.stores?.promptBlocks) {
      initTasks.push(this.stores.promptBlocks.init());
    }

    if (this.stores?.scorerDefinitions) {
      initTasks.push(this.stores.scorerDefinitions.init());
    }

    if (this.stores?.mcpClients) {
      initTasks.push(this.stores.mcpClients.init());
    }

    if (this.stores?.mcpServers) {
      initTasks.push(this.stores.mcpServers.init());
    }

    if (this.stores?.workspaces) {
      initTasks.push(this.stores.workspaces.init());
    }

    if (this.stores?.skills) {
      initTasks.push(this.stores.skills.init());
    }

    if (this.stores?.blobs) {
      initTasks.push(this.stores.blobs.init());
    }

    this.hasInitialized = Promise.all(initTasks).then(() => true);

    await this.hasInitialized;
  }
}

/**
 * @deprecated Use MastraCompositeStoreConfig instead. This alias will be removed in a future version.
 */
export interface MastraStorageConfig extends MastraCompositeStoreConfig {}

/**
 * @deprecated Use MastraCompositeStore instead. This alias will be removed in a future version.
 */
export class MastraStorage extends MastraCompositeStore {}
