import { MastraBase } from '../base';

import type {
  AgentsStorage,
  PromptBlocksStorage,
  ScorerDefinitionsStorage,
  MCPClientsStorage,
  MCPServersStorage,
  WorkspacesStorage,
  SkillsStorage,
  FavoritesStorage,
  ScoresStorage,
  WorkflowsStorage,
  MemoryStorage,
  ObservabilityStorage,
  BlobStore,
  DatasetsStorage,
  ExperimentsStorage,
  BackgroundTasksStorage,
  SchedulesStorage,
  ChannelsStorage,
  HarnessStorage,
  ToolProviderConnectionsStorage,
  NotificationsStorage,
  ThreadStateStorage,
  KnowledgeStorage,
} from './domains';
import { InMemoryThreadStateStorage } from './domains/thread-state/inmemory';
import type { PruneOptions, PruneResult, RetentionConfig, TableRetentionPolicy } from './retention';

/** Map of all storage domain interfaces available in a composite store. */
export type StorageDomains = {
  workflows?: WorkflowsStorage;
  scores?: ScoresStorage;
  memory?: MemoryStorage;
  channels?: ChannelsStorage;
  notifications?: NotificationsStorage;
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
  favorites?: FavoritesStorage;
  blobs?: BlobStore;
  backgroundTasks?: BackgroundTasksStorage;
  schedules?: SchedulesStorage;
  harness?: HarnessStorage;
  toolProviderConnections?: ToolProviderConnectionsStorage;
  threadState?: ThreadStateStorage;
  knowledge?: KnowledgeStorage;
};

/**
 * Domain keys used by the Mastra Editor.
 * Used by the `editor` shorthand on MastraCompositeStoreConfig to route
 * all editor-related domains to a single store.
 */
export const EDITOR_DOMAINS = [
  'agents',
  'promptBlocks',
  'scorerDefinitions',
  'mcpClients',
  'mcpServers',
  'workspaces',
  'skills',
  'favorites',
  'toolProviderConnections',
] as const satisfies ReadonlyArray<keyof StorageDomains>;

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
 *
 * Set a domain to `false` to disable it entirely: the domain resolves to
 * `undefined` instead of falling back to the `editor`/`default` stores, so
 * nothing can read from or write to it through this composite.
 */
export type MastraStorageDomains = {
  [K in keyof StorageDomains]?: StorageDomains[K] | false;
};

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
   * Storage adapter for editor-related domains (agents, promptBlocks, scorerDefinitions,
   * mcpClients, mcpServers, workspaces, skills).
   *
   * This is a shorthand that routes all editor domains to a single store instead of
   * specifying each individually in `domains`. Useful for filesystem-based storage
   * where editor configs are stored as JSON files in the repository.
   *
   * Priority: domains > editor > default
   *
   * @example
   * ```typescript
   * new MastraCompositeStore({
   *   id: 'my-store',
   *   default: postgresStore,
   *   editor: filesystemStore,
   * })
   * ```
   */
  editor?: MastraCompositeStore;

  /**
   * Individual domain overrides. Each domain can come from a different storage adapter.
   * These take precedence over both `editor` and `default` storage.
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

  /**
   * Opt-in, table-granular, age-based retention policies.
   *
   * Declare per-domain, per-table `maxAge` policies; call `storage.prune()`
   * to delete rows older than their configured age. Anything left unset is
   * kept forever (no behavior change by default).
   *
   * @example
   * ```typescript
   * retention: {
   *   memory: {
   *     messages: { maxAge: '30d' },
   *     threads: { maxAge: '90d' },
   *   },
   *   observability: {
   *     spans: { maxAge: '7d' },
   *   },
   * }
   * ```
   */
  retention?: RetentionConfig;
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
 * // Use `editor` shorthand to route all editor domains to a filesystem store
 * const storage2 = new MastraCompositeStore({
 *   id: 'with-fs-editor',
 *   default: pgStore,
 *   editor: filesystemStore,
 * });
 *
 * // Access domains
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 * ```
 */
/**
 * Minimal interface a storage adapter sees from the Mastra instance.
 * Kept narrow on purpose to avoid pulling the full Mastra type into the
 * storage layer (which would create a circular import).
 */
export interface StorageMastraRef {
  getAgentById?: (id: string) => { source?: string; __getEditorConfig?: () => unknown } | undefined;
  listAgents?: () => Record<string, { id: string; source?: string; __getEditorConfig?: () => unknown }> | undefined;
  getEditor?: () => { getSource?: () => 'code' | 'db' | undefined } | undefined;
}

/** A domain that implements the age-based retention `prune()` contract. */
interface PruneCapable {
  prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]>;
}

function isPruneCapable(value: unknown): value is PruneCapable {
  return typeof value === 'object' && value !== null && typeof (value as PruneCapable).prune === 'function';
}

export class MastraCompositeStore extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;
  protected mastra?: StorageMastraRef;

  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   */
  disableInit: boolean = false;

  /**
   * Opt-in, table-granular, age-based retention policies. Consumed by
   * `prune()`. Undefined means nothing is pruned (keep forever).
   */
  protected retention?: RetentionConfig;

  /**
   * Retained references to the parent stores supplied via composition. `init()`
   * delegates to these so the parent's own `init()` logic (pragmas, ordered
   * DDL, init coalescing, etc.) runs instead of being bypassed by the
   * composite iterating the inner domains in parallel — which was the cause
   * of the SQLITE_BUSY / "no such table" races reported in issue #16782.
   */
  protected parentDefault?: MastraCompositeStore;
  protected parentEditor?: MastraCompositeStore;

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
    this.retention = config.retention;

    // If composition config is provided (default, editor, or domains), compose the stores
    if (config.default || config.editor || config.domains) {
      const defaultStores = config.default?.stores;
      const editorStores = config.editor?.stores;
      const domainOverrides = config.domains ?? {};

      // Retain the parent store refs so init() can delegate to their own
      // init() — see field doc above and init() below.
      this.parentDefault = config.default;
      this.parentEditor = config.editor;

      // Validate that at least one storage source is provided (a `false`
      // override disables a domain, so it doesn't count as a source)
      const hasDefaultDomains = defaultStores && Object.values(defaultStores).some(v => v !== undefined);
      const hasEditorDomains = editorStores && Object.values(editorStores).some(v => v !== undefined);
      const hasOverrideDomains = Object.values(domainOverrides).some(v => v !== undefined && v !== false);

      if (!hasDefaultDomains && !hasEditorDomains && !hasOverrideDomains) {
        throw new Error(
          'MastraCompositeStore requires at least one storage source. Provide a default storage, an editor storage, or domain overrides.',
        );
      }

      const editorDomainSet = new Set<string>(EDITOR_DOMAINS);

      // Helper: resolve a domain with priority: domains > editor (for editor domains) > default.
      // A `false` override disables the domain — it resolves to undefined
      // instead of falling through to the editor/default stores.
      const resolve = <K extends keyof StorageDomains>(key: K): StorageDomains[K] | undefined => {
        const override: StorageDomains[K] | false | undefined = domainOverrides[key];
        if (override === false) return undefined;
        if (override !== undefined) return override;
        if (editorDomainSet.has(key) && editorStores?.[key] !== undefined) return editorStores[key];
        return defaultStores?.[key];
      };

      // Build the composed stores object
      this.stores = {
        memory: resolve('memory'),
        workflows: resolve('workflows'),
        scores: resolve('scores'),
        observability: resolve('observability'),
        agents: resolve('agents'),
        datasets: resolve('datasets'),
        experiments: resolve('experiments'),
        promptBlocks: resolve('promptBlocks'),
        scorerDefinitions: resolve('scorerDefinitions'),
        mcpClients: resolve('mcpClients'),
        mcpServers: resolve('mcpServers'),
        workspaces: resolve('workspaces'),
        skills: resolve('skills'),
        favorites: resolve('favorites'),
        blobs: resolve('blobs'),
        backgroundTasks: resolve('backgroundTasks'),
        schedules: resolve('schedules'),
        channels: resolve('channels'),
        harness: resolve('harness'),
        toolProviderConnections: resolve('toolProviderConnections'),
        notifications: resolve('notifications'),
        // The thread-state domain always has an in-memory store wired by default
        // so the built-in task tools work out of the box without a configured
        // backend. Configure a durable backend for state that must survive a
        // process restart. An explicit `false` override still disables the
        // domain entirely — the in-memory fallback only applies when the
        // domain is left unset.
        threadState:
          domainOverrides.threadState === false
            ? undefined
            : (resolve('threadState') ?? new InMemoryThreadStateStorage()),
      } as StorageDomains;
    }
    // Otherwise, subclasses set stores themselves
  }

  /**
   * Register the Mastra instance with this storage adapter and cascade the
   * reference to all owned domain stores and parent composites. Storage
   * adapters that need to look up agents, editor config, etc. can read
   * `this.mastra` after this is called.
   * @internal
   */
  __registerMastra(mastra: StorageMastraRef, seen: Set<unknown> = new Set<unknown>()): void {
    if (seen.has(this)) return;
    seen.add(this);
    this.mastra = mastra;
    const cascade = (target: unknown) => {
      if (!target || typeof target !== 'object' || seen.has(target)) return;
      const fn = (target as { __registerMastra?: (m: StorageMastraRef, s?: Set<unknown>) => void }).__registerMastra;
      if (typeof fn === 'function') {
        fn.call(target, mastra, seen);
      } else {
        seen.add(target);
      }
    };
    if (this.parentDefault) cascade(this.parentDefault);
    if (this.parentEditor) cascade(this.parentEditor);
    if (this.stores) {
      for (const domain of Object.values(this.stores)) cascade(domain);
    }
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
   * Delete rows older than their configured `maxAge` across all domains that
   * have a policy declared in `retention`.
   *
   * Prune is safe at scale: each domain deletes in bounded, batched, resumable,
   * cancellable chunks (see {@link PruneOptions}). It only deletes rows. On
   * SQLite/LibSQL freed pages are reused by future writes so the file stops
   * growing; handing disk back to the OS is left to the underlying database and
   * the operator to manage.
   *
   * Returns one {@link PruneResult} per table touched. A result with
   * `done: false` means eligible rows remain — call `prune()` again (e.g. on
   * the next cron tick) to continue.
   *
   * Prune is meant to run unattended (a cron tick), so a failure in one
   * domain is logged and skipped rather than rejecting the whole call — the
   * results already gathered for other domains are still returned, and the
   * failed domain is retried naturally on the next tick.
   *
   * With no `retention` configured this is a no-op returning `[]`.
   *
   * Pass `options.retention` to replace the configured retention policies for
   * this call only — e.g. to skip a domain (keep chat history) or prune more
   * aggressively than the standing config without reconstructing the store.
   */
  async prune(options?: PruneOptions): Promise<PruneResult[]> {
    const retention = options?.retention ?? this.retention;
    if (!retention) return [];

    const results: PruneResult[] = [];
    for (const [domainKey, tablePolicies] of Object.entries(retention) as [
      keyof StorageDomains,
      Record<string, TableRetentionPolicy> | undefined,
    ][]) {
      if (options?.signal?.aborted) break;
      if (!tablePolicies || Object.keys(tablePolicies).length === 0) continue;

      const domain = this.stores?.[domainKey];
      if (!isPruneCapable(domain)) continue; // domain not configured / doesn't support retention

      try {
        const domainResults = await domain.prune(tablePolicies, options);
        results.push(...domainResults);
      } catch (error) {
        this.logger?.error(`prune() failed for domain "${domainKey}"`, { error });
      }
    }
    return results;
  }

  /**
   * Initialize all domain stores.
   *
   * When a parent store was supplied via `default` or `editor`, delegate to
   * its own `init()` first. Each adapter owns its `init()` contract — it may
   * apply connection-level setup, run migrations, enforce DDL ordering, or
   * coalesce concurrent callers. Calling each domain's `init()` directly
   * against the parent's shared client would bypass all of that and can
   * corrupt or partially create schema (see issue #16782 for the SQLite
   * symptom).
   *
   * Any remaining domains that did NOT come from a parent (e.g. supplied via
   * the explicit `domains` override pointing at a different store) are then
   * initialized individually — but only the ones the parents didn't already
   * cover, so we never double-init the same domain instance.
   */
  async init(): Promise<void> {
    if (!this.shouldCacheInit) {
      await this.#runInit();
      return;
    }

    if (this.hasInitialized) {
      await this.hasInitialized;
      return;
    }

    const initPromise = this.#runInit().catch(error => {
      if (this.hasInitialized === initPromise) {
        this.hasInitialized = null;
      }
      throw error;
    });
    this.hasInitialized = initPromise;
    await initPromise;
  }

  async #runInit(): Promise<boolean> {
    // 1. Delegate to parent stores. Each parent owns its own init contract
    //    (setup, migrations, sequencing, coalescing). Dedupe by identity so
    //    a store passed as both `default` and `editor` only gets init()'d once.
    const uniqueParents = new Set<MastraCompositeStore>();
    if (this.parentDefault) uniqueParents.add(this.parentDefault);
    if (this.parentEditor) uniqueParents.add(this.parentEditor);
    await Promise.all([...uniqueParents].map(parent => parent.init()));

    // 2. Build a set of domain instances the parents already initialized so
    //    we don't init them a second time below.
    const alreadyInitialized = new Set<unknown>();
    const addParentDomains = (parent?: MastraCompositeStore) => {
      if (!parent?.stores) return;
      for (const domain of Object.values(parent.stores)) {
        if (domain) alreadyInitialized.add(domain);
      }
    };
    addParentDomains(this.parentDefault);
    addParentDomains(this.parentEditor);

    // 3. Init any remaining domains (typically those provided via the
    //    explicit `domains` override pointing at a different store, or those
    //    set directly by a subclass).
    const initTasks: Promise<void>[] = [];
    const maybeInit = (domain: { init(): Promise<void> } | undefined) => {
      if (!domain || alreadyInitialized.has(domain)) return;
      initTasks.push(domain.init());
      alreadyInitialized.add(domain);
    };

    if (this.stores) {
      maybeInit(this.stores.memory);
      maybeInit(this.stores.workflows);
      maybeInit(this.stores.scores);
      maybeInit(this.stores.observability);
      maybeInit(this.stores.agents);
      maybeInit(this.stores.datasets);
      maybeInit(this.stores.experiments);
      maybeInit(this.stores.promptBlocks);
      maybeInit(this.stores.scorerDefinitions);
      maybeInit(this.stores.mcpClients);
      maybeInit(this.stores.mcpServers);
      maybeInit(this.stores.workspaces);
      maybeInit(this.stores.skills);
      maybeInit(this.stores.favorites);
      maybeInit(this.stores.blobs);
      maybeInit(this.stores.backgroundTasks);
      maybeInit(this.stores.schedules);
      maybeInit(this.stores.channels);
      maybeInit(this.stores.harness);
      maybeInit(this.stores.toolProviderConnections);
      maybeInit(this.stores.notifications);
      maybeInit(this.stores.threadState);
    }

    await Promise.all(initTasks);
    return true;
  }
  /**
   * Optional lifecycle hook: release underlying client/connection handles.
   * Implementations (e.g. LibSQLStore) override this to checkpoint WAL files
   * and close the database client so OS handles are freed synchronously.
   * Called automatically by Mastra.shutdown().
   */
  close?(): Promise<void>;
}

/**
 * @deprecated Use MastraCompositeStoreConfig instead. This alias will be removed in a future version.
 */
export interface MastraStorageConfig extends MastraCompositeStoreConfig {}

/**
 * @deprecated Use MastraCompositeStore instead. This alias will be removed in a future version.
 */
export class MastraStorage extends MastraCompositeStore {}
