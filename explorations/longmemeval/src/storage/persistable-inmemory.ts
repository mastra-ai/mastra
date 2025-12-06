import {
  InMemoryMemory,
  InMemoryThreads,
  InMemoryResources,
  InMemoryMessages,
  InMemoryObservationalMemory,
} from '@mastra/core/storage';
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Extended InMemoryMemory with persist/hydrate capabilities for benchmarking.
 * Allows saving and loading the in-memory state to/from disk.
 *
 * NOTE: We store a reference to the same Map instances that are passed to the parent class.
 * When hydrating, we must clear and repopulate these maps instead of replacing them,
 * otherwise the parent class won't see the updated data.
 */
export class PersistableInMemoryMemory extends InMemoryMemory {
  private _collection: {
    threads: InMemoryThreads;
    resources: InMemoryResources;
    messages: InMemoryMessages;
    observationalMemory: InMemoryObservationalMemory;
  };

  constructor() {
    const collection = {
      threads: new Map(),
      resources: new Map(),
      messages: new Map(),
      observationalMemory: new Map(),
    };

    super({
      collection,
      operations: {} as any, // Not needed for benchmark
    });

    // Store the SAME map instances that were passed to super()
    this._collection = collection;
  }

  /**
   * Persist the current storage state to a JSON file
   */
  async persist(filePath: string): Promise<void> {
    const data: Record<string, any> = {
      threads: Array.from(this._collection.threads.entries()),
      resources: Array.from(this._collection.resources.entries()),
      messages: Array.from(this._collection.messages.entries()),
      observationalMemory: Array.from(this._collection.observationalMemory.entries()),
    };

    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Hydrate storage state from a JSON file.
   * IMPORTANT: We clear and repopulate the existing maps to preserve references.
   */
  async hydrate(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Storage file not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Clear existing data first
    this._collection.threads.clear();
    this._collection.resources.clear();
    this._collection.messages.clear();
    this._collection.observationalMemory.clear();

    // Restore data into the SAME map instances (don't replace the maps!)
    if (data.threads) {
      for (const [key, value] of data.threads) {
        this._collection.threads.set(key, value);
      }
    }
    if (data.resources) {
      for (const [key, value] of data.resources) {
        this._collection.resources.set(key, value);
      }
    }
    if (data.messages) {
      for (const [key, value] of data.messages) {
        this._collection.messages.set(key, value);
      }
    }
    if (data.observationalMemory) {
      for (const [key, value] of data.observationalMemory) {
        this._collection.observationalMemory.set(key, value);
      }
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this._collection.threads.clear();
    this._collection.resources.clear();
    this._collection.messages.clear();
    this._collection.observationalMemory.clear();
  }

  /**
   * Get stats about stored data
   */
  getStats(): {
    threads: number;
    resources: number;
    messages: number;
    observationalMemoryRecords: number;
  } {
    return {
      threads: this._collection.threads.size,
      resources: this._collection.resources.size,
      messages: this._collection.messages.size,
      observationalMemoryRecords: this._collection.observationalMemory.size,
    };
  }
}
