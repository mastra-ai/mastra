import type { Mastra } from '@mastra/core';
import type { IMastraLogger as Logger } from '@mastra/core/logger';
import type { GetByIdOptions } from '@mastra/core/editor';
import type { MastraEditor } from '../index';

export type { GetByIdOptions };

/**
 * Adapter interface that bridges entity-specific storage method names
 * to a generic CRUD interface. Each CrudEditorNamespace subclass implements
 * this to map its storage domain's methods.
 */
export interface StorageAdapter<
  TCreateInput extends { id: string },
  TUpdateInput extends { id: string },
  TListInput,
  TListOutput,
  TListResolvedOutput,
  TResolved,
> {
  create(input: TCreateInput): Promise<unknown>;
  getByIdResolved(id: string, options?: GetByIdOptions): Promise<TResolved | null>;
  update(input: TUpdateInput): Promise<unknown>;
  delete(id: string): Promise<void>;
  list(args?: TListInput): Promise<TListOutput>;
  listResolved(args?: TListInput): Promise<TListResolvedOutput>;
}

/**
 * Base class for all editor namespaces.
 * Provides shared infrastructure: mastra/logger access and registration check.
 */
export abstract class EditorNamespace {
  constructor(protected editor: MastraEditor) {}

  protected get mastra(): Mastra | undefined {
    return this.editor.__mastra;
  }

  protected get logger(): Logger | undefined {
    return this.editor.__logger;
  }

  protected ensureRegistered(): void {
    if (!this.editor.__mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }
  }
}

/**
 * Abstract base class for editor namespaces with full CRUD operations.
 *
 * Generic parameters:
 * - TCreateInput / TUpdateInput — storage input shapes
 * - TListInput / TListOutput / TListResolvedOutput — list shapes
 * - TResolved — the raw config shape returned from storage
 * - THydrated — the runtime primitive type returned by getById (defaults to TResolved)
 *
 * Subclasses override `hydrate()` to convert raw config into a runtime primitive.
 * For namespaces without hydration (e.g. prompts), THydrated = TResolved and hydrate is identity.
 *
 * Includes a built-in cache for getById results. Mutations (create/update/delete)
 * automatically invalidate the cache for the affected entity.
 */
export abstract class CrudEditorNamespace<
  TCreateInput extends { id: string },
  TUpdateInput extends { id: string },
  TListInput,
  TListOutput,
  TListResolvedOutput,
  TResolved,
  THydrated = TResolved,
> extends EditorNamespace {
  protected _cache = new Map<string, THydrated>();

  /**
   * Each subclass must provide a storage adapter that maps
   * entity-specific storage method names to the generic interface.
   */
  protected abstract getStorageAdapter(): Promise<
    StorageAdapter<TCreateInput, TUpdateInput, TListInput, TListOutput, TListResolvedOutput, TResolved>
  >;

  /**
   * Convert a raw resolved config into a runtime primitive.
   * Override in subclasses that need hydration (e.g. agents → Agent instance).
   * Default implementation returns the resolved config as-is.
   */
  protected async hydrate(resolved: TResolved): Promise<THydrated> {
    return resolved as unknown as THydrated;
  }

  /**
   * Hook called when an entity is evicted from the cache (on delete, update, or clearCache).
   * Override in subclasses to also remove the entity from the Mastra runtime registry.
   */
  protected onCacheEvict(_id: string): void {
    // Default: no-op. Subclasses override to clean up runtime registries.
  }

  async create(input: TCreateInput): Promise<THydrated> {
    this.ensureRegistered();
    const adapter = await this.getStorageAdapter();
    await adapter.create(input);
    const resolved = await adapter.getByIdResolved(input.id);
    if (!resolved) {
      throw new Error(`Failed to resolve entity ${input.id} after creation`);
    }
    const hydrated = await this.hydrate(resolved);
    this._cache.set(input.id, hydrated);
    return hydrated;
  }

  async getById(id: string, options?: GetByIdOptions): Promise<THydrated | null> {
    this.ensureRegistered();

    // Only use the cache for default (latest) version requests
    const isVersionRequest = options?.versionId || options?.versionNumber;
    if (!isVersionRequest) {
      const cached = this._cache.get(id);
      if (cached) {
        this.logger?.debug(`[getById] Cache hit for "${id}"`);
        return cached;
      }
    }

    this.logger?.debug(`[getById] Cache miss for "${id}", fetching from storage`);
    const adapter = await this.getStorageAdapter();
    const resolved = await adapter.getByIdResolved(id, options);
    if (!resolved) return null;

    const hydrated = await this.hydrate(resolved);

    // Only cache default (latest) version
    if (!isVersionRequest) {
      this._cache.set(id, hydrated);
    }
    return hydrated;
  }

  async update(input: TUpdateInput): Promise<THydrated> {
    this.ensureRegistered();
    const adapter = await this.getStorageAdapter();
    await adapter.update(input);
    this._cache.delete(input.id);
    this.onCacheEvict(input.id);
    const resolved = await adapter.getByIdResolved(input.id);
    if (!resolved) {
      throw new Error(`Failed to resolve entity ${input.id} after update`);
    }
    const hydrated = await this.hydrate(resolved);
    this._cache.set(input.id, hydrated);
    return hydrated;
  }

  async delete(id: string): Promise<void> {
    this.ensureRegistered();
    const adapter = await this.getStorageAdapter();
    await adapter.delete(id);
    this._cache.delete(id);
    this.onCacheEvict(id);
  }

  async list(args?: TListInput): Promise<TListOutput> {
    this.ensureRegistered();
    const adapter = await this.getStorageAdapter();
    return adapter.list(args);
  }

  async listResolved(args?: TListInput): Promise<TListResolvedOutput> {
    this.ensureRegistered();
    const adapter = await this.getStorageAdapter();
    return adapter.listResolved(args);
  }

  /**
   * Clear cached entities. If an id is provided, only that entity is cleared.
   * Otherwise all cached entities in this namespace are cleared.
   */
  clearCache(id?: string): void {
    if (id) {
      this._cache.delete(id);
      this.onCacheEvict(id);
      this.logger?.debug(`[clearCache] Cleared cache for "${id}"`);
    } else {
      for (const cachedId of Array.from(this._cache.keys())) {
        this.onCacheEvict(cachedId);
      }
      this._cache.clear();
      this.logger?.debug('[clearCache] Cleared all cached entities');
    }
  }
}
