import {
  calculatePagination,
  DEFAULT_SAVED_VIEW_ORDER_BY,
  DEFAULT_SAVED_VIEWS_PER_PAGE,
  normalizePerPage,
  resolveListOrderBy,
  SAVED_VIEW_ORDER_BY_FIELDS,
  SavedViewsStorage,
  TABLE_SAVED_VIEWS,
} from '@mastra/core/storage';
import type {
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  UpdateSavedViewInput,
} from '@mastra/core/storage';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

function docToSavedView(doc: Record<string, any>): SavedView {
  return {
    id: String(doc.id),
    page: doc.page,
    name: doc.name,
    authorId: doc.authorId ?? null,
    state: doc.state,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt),
  };
}

export class MongoDBSavedViewsStorage extends SavedViewsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_SAVED_VIEWS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBSavedViewsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SAVED_VIEWS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_SAVED_VIEWS, keys: { page: 1, createdAt: -1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
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
    if (!this.#indexes || this.#indexes.length === 0) return;
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

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    await collection.deleteMany({});
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    const filter: Record<string, unknown> = {};
    if (args.page !== undefined) filter.page = args.page;

    const total = await collection.countDocuments(filter);
    const hasMore = perPageInput === false ? false : total > offset + perPage;
    // `limit(0)` means "no limit" in MongoDB, so an empty page is answered here.
    if (total === 0 || perPage === 0) {
      return { views: [], pagination: { total, page, perPage: perPageForResponse, hasMore } };
    }

    const sortOrder = orderBy.direction === 'ASC' ? 1 : -1;
    let cursor = collection
      .find<Record<string, any>>(filter)
      .sort({ [orderBy.field]: sortOrder, id: 1 })
      .skip(offset);
    if (perPageInput !== false) cursor = cursor.limit(perPage);
    const docs = await cursor.toArray();

    return {
      views: docs.map(docToSavedView),
      pagination: { total, page, perPage: perPageForResponse, hasMore },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    const doc = await collection.findOne<Record<string, any>>({ id });
    return doc ? docToSavedView(doc) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    const now = new Date();
    const doc: Record<string, any> = {
      id,
      page: input.page,
      name: input.name,
      authorId: input.authorId ?? null,
      state: input.state,
      createdAt: now,
      updatedAt: now,
    };

    if (await collection.findOne({ id })) {
      throw new Error(`Saved view "${id}" already exists`);
    }
    try {
      await collection.insertOne(doc);
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        throw new Error(`Saved view "${id}" already exists`);
      }
      throw error;
    }
    return docToSavedView(doc);
  }

  async update(id: string, patch: UpdateSavedViewInput): Promise<SavedView | null> {
    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.state !== undefined) update.state = patch.state;

    const updated = await collection.findOneAndUpdate({ id }, { $set: update }, { returnDocument: 'after' });
    return updated ? docToSavedView(updated) : null;
  }

  async delete(id: string): Promise<void> {
    const collection = await this.getCollection(TABLE_SAVED_VIEWS);
    await collection.deleteOne({ id });
  }
}
