import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { BlobStore, createStorageErrorId, TABLE_SKILL_BLOBS } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

export class MongoDBBlobStore extends BlobStore {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_SKILL_BLOBS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBBlobStore.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [{ collection: TABLE_SKILL_BLOBS, keys: { hash: 1 }, options: { unique: true } }];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const doc = {
        hash: entry.hash,
        content: entry.content,
        size: entry.size,
        mimeType: entry.mimeType ?? null,
        createdAt: entry.createdAt ?? new Date(),
      };
      await collection.updateOne({ hash: entry.hash }, { $setOnInsert: doc }, { upsert: true });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'PUT_BLOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash: entry.hash },
        },
        error,
      );
    }
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const result = await collection.findOne<Record<string, any>>({ hash });
      if (!result) {
        return null;
      }
      return this.#parseDoc(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_BLOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  async has(hash: string): Promise<boolean> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const result = await collection.findOne({ hash }, { projection: { _id: 1 } });
      return result !== null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'HAS_BLOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  async delete(hash: string): Promise<boolean> {
    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const result = await collection.deleteOne({ hash });
      return result.deletedCount > 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_BLOB', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { hash },
        },
        error,
      );
    }
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const operations = entries.map(entry => ({
        updateOne: {
          filter: { hash: entry.hash },
          update: {
            $setOnInsert: {
              hash: entry.hash,
              content: entry.content,
              size: entry.size,
              mimeType: entry.mimeType ?? null,
              createdAt: entry.createdAt ?? new Date(),
            },
          },
          upsert: true,
        },
      }));
      await collection.bulkWrite(operations);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'PUT_MANY_BLOBS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: entries.length },
        },
        error,
      );
    }
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    try {
      const collection = await this.getCollection(TABLE_SKILL_BLOBS);
      const docs = await collection.find<Record<string, any>>({ hash: { $in: hashes } }).toArray();
      for (const doc of docs) {
        const entry = this.#parseDoc(doc);
        result.set(entry.hash, entry);
      }
      return result;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MANY_BLOBS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: hashes.length },
        },
        error,
      );
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_SKILL_BLOBS);
    await collection.deleteMany({});
  }

  #parseDoc(doc: Record<string, any>): StorageBlobEntry {
    return {
      hash: doc.hash as string,
      content: doc.content as string,
      size: Number(doc.size),
      mimeType: (doc.mimeType as string) || undefined,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    };
  }
}
