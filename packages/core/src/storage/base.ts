import { MastraBase } from '../base';

import type { AgentsStorage, ScoresStorage, WorkflowsStorage, MemoryStorage, ObservabilityStorage } from './domains';

export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
};

/**
 * Normalizes perPage input for pagination queries.
 *
 * @param perPageInput - The raw perPage value from the user
 * @param defaultValue - The default perPage value to use when undefined (typically 40 for messages, 100 for threads)
 * @returns A numeric perPage value suitable for queries (false becomes MAX_SAFE_INTEGER, negative values fall back to default)
 */
export function normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
  if (perPageInput === false) {
    return Number.MAX_SAFE_INTEGER; // Get all results
  } else if (perPageInput === 0) {
    return 0; // Return zero results
  } else if (typeof perPageInput === 'number' && perPageInput > 0) {
    return perPageInput; // Valid positive number
  }
  // For undefined, negative, or other invalid values, use default
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
 * Base class for all Mastra storage adapters.
 *
 * Storage adapters provide persistence for various domains (memory, workflows, scores, observability, agents).
 * All domain-specific operations should be accessed through `getStore()`:
 *
 * @example
 * ```typescript
 * // Access memory domain
 * const memory = await storage.getStore('memory');
 * await memory?.saveThread({ thread });
 *
 * // Access workflows domain
 * const workflows = await storage.getStore('workflows');
 * await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });
 *
 * // Access observability domain
 * const observability = await storage.getStore('observability');
 * await observability?.createSpan(span);
 * ```
 */
export abstract class MastraStorage extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;

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
  disableInit: boolean = false;

  constructor({ id, name, disableInit }: { id: string; name: string; disableInit?: boolean }) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`${name}: id must be provided and cannot be empty.`);
    }
    super({
      component: 'STORAGE',
      name,
    });
    this.id = id;
    this.disableInit = disableInit ?? false;
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

    this.hasInitialized = Promise.all(initTasks).then(() => true);

    await this.hasInitialized;
  }
}
