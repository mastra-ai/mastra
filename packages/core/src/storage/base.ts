import { MastraBase } from '../base';
import type { ObservabilityStorageBase, WorkflowsStorageBase, EvalsStorageBase, MemoryStorageBase } from './domains';
import type { StorageColumn } from './types';

export type StorageDomains = {
  workflows?: WorkflowsStorageBase;
  evals?: EvalsStorageBase;
  memory?: MemoryStorageBase;
  observability?: ObservabilityStorageBase;
};

export function ensureDate(date: Date | string | undefined): Date | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date : new Date(date);
}

export function serializeDate(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  const dateObj = ensureDate(date);
  return dateObj?.toISOString();
}

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

export function getDefaultValue(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
    case 'uuid':
      return "DEFAULT ''";
    case 'timestamp':
      return "DEFAULT '1970-01-01 00:00:00'";
    case 'integer':
    case 'float':
    case 'bigint':
      return 'DEFAULT 0';
    case 'boolean':
      return 'DEFAULT FALSE';
    case 'jsonb':
      return "DEFAULT '{}'";
    default:
      return "DEFAULT ''";
  }
}

export function getSqlType(type: StorageColumn['type']): string {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'timestamp':
      return 'TIMESTAMP';
    case 'float':
      return 'FLOAT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'jsonb':
      return 'JSONB';
    default:
      return 'TEXT';
  }
}

export class MastraStorage extends MastraBase {
  protected hasInitialized: null | Promise<boolean> = null;
  protected shouldCacheInit = true;

  id: string;
  stores?: StorageDomains;

  constructor({ id, name, stores }: { id: string; name: string; stores?: StorageDomains }) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`${name}: id must be provided and cannot be empty.`);
    }
    super({
      component: 'STORAGE',
      name,
    });
    this.id = id;

    if (stores) {
      this.stores = stores;
    }
  }

  public get supports(): {
    selectByIncludeResourceScope: boolean;
    resourceWorkingMemory: boolean;
    hasColumn: boolean;
    createTable: boolean;
    deleteMessages: boolean;
    observabilityInstance?: boolean;
    indexManagement?: boolean;
    listScoresBySpan?: boolean;
  } {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: false,
      observabilityInstance: false,
      indexManagement: false,
      listScoresBySpan: false,
    };
  }

  /**
   * Get access to the underlying storage domains for advanced operations
   */
  public async getStore<K extends keyof StorageDomains>(id: K): Promise<StorageDomains[K] | undefined> {
    return this.stores?.[id];
  }

  async init(): Promise<void> {
    // to prevent race conditions, await any current init
    if (this.shouldCacheInit && (await this.hasInitialized)) {
      return;
    }

    const initTasks: Promise<void>[] = [];

    // Initialize memory domain (threads, messages, resources)
    if (this.stores?.memory) {
      initTasks.push(this.stores.memory.init());
    }

    // Initialize workflows domain (workflow snapshots)
    if (this.stores?.workflows) {
      initTasks.push(this.stores.workflows.init());
    }

    // Initialize scores domain (evals)
    if (this.stores?.evals) {
      initTasks.push(this.stores.evals.init());
    }

    // Initialize observability domain (traces, spans)
    if (this.stores?.observability) {
      initTasks.push(this.stores.observability.init());
    }

    this.hasInitialized = Promise.all(initTasks).then(() => true);

    await this.hasInitialized;
  }
}
