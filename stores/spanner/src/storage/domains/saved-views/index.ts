import type { Database } from '@google-cloud/spanner';
import {
  calculatePagination,
  DEFAULT_SAVED_VIEW_ORDER_BY,
  DEFAULT_SAVED_VIEWS_PER_PAGE,
  normalizePerPage,
  resolveListOrderBy,
  SAVED_VIEW_ORDER_BY_FIELDS,
  SAVED_VIEWS_SCHEMA,
  SavedViewsStorage,
  TABLE_SAVED_VIEWS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  UpdateSavedViewInput,
} from '@mastra/core/storage';

import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function rowToSavedView(row: Record<string, any>): SavedView {
  const parsed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SAVED_VIEWS, row });
  if (parsed.state == null) {
    throw new Error(`Saved view row "${String(parsed.id)}" is missing its state.`);
  }
  return {
    id: String(parsed.id),
    page: String(parsed.page),
    name: String(parsed.name),
    authorId: parsed.authorId == null ? null : String(parsed.authorId),
    updatedById: parsed.updatedById == null ? null : String(parsed.updatedById),
    resourceId: parsed.resourceId == null ? null : String(parsed.resourceId),
    state: parsed.state,
    createdAt: parsed.createdAt instanceof Date ? parsed.createdAt : new Date(parsed.createdAt),
    updatedAt: parsed.updatedAt instanceof Date ? parsed.updatedAt : new Date(parsed.updatedAt),
  };
}

export class SavedViewsSpanner extends SavedViewsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SAVED_VIEWS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (SavedViewsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  private getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_saved_views_page_createdat_idx',
        table: TABLE_SAVED_VIEWS,
        columns: ['page', 'createdAt'],
      },
    ];
  }

  private async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  private async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SAVED_VIEWS });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const tableName = quoteIdent(TABLE_SAVED_VIEWS, 'table name');
    const params: Record<string, any> = {};
    const conditions: string[] = [];
    if (args.page !== undefined) {
      params.page = args.page;
      conditions.push(`${quoteIdent('page', 'column name')} = @page`);
    }
    if (args.resourceId !== undefined) {
      params.resourceId = args.resourceId;
      conditions.push(`${quoteIdent('resourceId', 'column name')} = @resourceId`);
    }
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await this.database.run({
      sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
      params,
      json: true,
    });
    const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
    if (total === 0) {
      return { views: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
    }

    const [rows] = await this.database.run({
      sql: `SELECT * FROM ${tableName} ${whereSql}
            ORDER BY ${quoteIdent(orderBy.field, 'column name')} ${orderBy.direction}, ${quoteIdent('id', 'column name')} ASC
            LIMIT @limit OFFSET @offset`,
      params: { ...params, limit: perPageInput === false ? total : perPage, offset },
      json: true,
    });

    return {
      views: (rows as Array<Record<string, any>>).map(rowToSavedView),
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const row = await this.db.load<Record<string, any>>({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
    return row ? rowToSavedView(row) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    if (await this.get(id)) {
      throw new Error(`Saved view "${id}" already exists`);
    }

    const now = new Date();
    await this.db.insert({
      tableName: TABLE_SAVED_VIEWS,
      record: {
        id,
        page: input.page,
        name: input.name,
        authorId: input.authorId ?? null,
        updatedById: input.authorId ?? null,
        resourceId: input.resourceId ?? null,
        state: input.state,
        createdAt: now,
        updatedAt: now,
      },
    });
    const created = await this.get(id);
    if (!created) throw new Error(`Failed to persist saved view "${id}".`);
    return created;
  }

  async update(id: string, patch: UpdateSavedViewInput): Promise<SavedView | null> {
    if (!(await this.get(id))) return null;

    const data: Record<string, any> = { updatedAt: new Date() };
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.state !== undefined) data.state = patch.state;
    if (patch.updatedById !== undefined) data.updatedById = patch.updatedById;

    await this.db.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.runDml({
      sql: `DELETE FROM ${quoteIdent(TABLE_SAVED_VIEWS, 'table name')} WHERE id = @id`,
      params: { id },
    });
  }
}
