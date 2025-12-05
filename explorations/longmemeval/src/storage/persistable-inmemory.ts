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
   * Hydrate storage state from a JSON file
   */
  async hydrate(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      throw new Error(`Storage file not found: ${filePath}`);
    }

    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Restore Maps from arrays
    if (data.threads) {
      this._collection.threads = new Map(data.threads);
    }
    if (data.resources) {
      this._collection.resources = new Map(data.resources);
    }
    if (data.messages) {
      this._collection.messages = new Map(data.messages);
    }
    if (data.observationalMemory) {
      this._collection.observationalMemory = new Map(data.observationalMemory);
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
