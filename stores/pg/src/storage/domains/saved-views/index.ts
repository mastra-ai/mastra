import {
  calculatePagination,
  DEFAULT_SAVED_VIEW_ORDER_BY,
  DEFAULT_SAVED_VIEWS_PER_PAGE,
  normalizePerPage,
  resolveListOrderBy,
  SAVED_VIEW_ORDER_BY_FIELDS,
  SavedViewsStorage,
  TABLE_SAVED_VIEWS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  SavedViewState,
  UpdateSavedViewInput,
} from '@mastra/core/storage';

import { schemaNamePrefix } from '../../../shared/schema-name';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { DbClient, PgDomainConfig } from '../../db';
import { getSchemaName, getTableName, parseJsonResilient } from '../utils';

function rowToSavedView(row: Record<string, unknown>): SavedView {
  return {
    id: String(row.id),
    page: String(row.page),
    name: String(row.name),
    authorId: row.authorId == null ? null : String(row.authorId),
    updatedById: row.updatedById == null ? null : String(row.updatedById),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    state: parseJsonResilient(row.state) as SavedViewState,
    createdAt: new Date((row.createdAtZ ?? row.createdAt) as string | number | Date),
    updatedAt: new Date((row.updatedAtZ ?? row.updatedAt) as string | number | Date),
  };
}

export class SavedViewsPG extends SavedViewsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SAVED_VIEWS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (SavedViewsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_SAVED_VIEWS,
        schema: TABLE_SCHEMAS[TABLE_SAVED_VIEWS],
        schemaName,
        includeAllConstraints: true,
      }),
    ];
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
    return [
      {
        name: `${schemaPrefix}idx_saved_views_page_createdat`,
        table: TABLE_SAVED_VIEWS,
        columns: ['page', 'createdAt'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SAVED_VIEWS, schema: TABLE_SCHEMAS[TABLE_SAVED_VIEWS] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SAVED_VIEWS });
  }

  #tableName(): string {
    return getTableName({ indexName: TABLE_SAVED_VIEWS, schemaName: getSchemaName(this.#schema) });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const tableName = this.#tableName();

    const params: unknown[] = [];
    const conditions: string[] = [];
    if (args.page !== undefined) {
      params.push(args.page);
      conditions.push(`"page" = $${params.length}`);
    }
    if (args.resourceId !== undefined) {
      params.push(args.resourceId);
      conditions.push(`"resourceId" = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.#db.readClient.one(`SELECT COUNT(*) as count FROM ${tableName} ${where}`, params);
    const total = parseInt(countResult.count, 10);
    if (total === 0) {
      return { views: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
    }

    const limitValue = perPageInput === false ? total : perPage;
    const rows = await this.#db.readClient.manyOrNone(
      `SELECT * FROM ${tableName} ${where} ORDER BY "${orderBy.field}" ${orderBy.direction}, "id" ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitValue, offset],
    );

    return {
      views: rows.map(row => rowToSavedView(row as Record<string, unknown>)),
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : total > offset + perPage,
      },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    return this.#get(this.#db.readClient, id);
  }

  /**
   * Same lookup against an explicit client. Mutation paths pass the writer so a
   * lagging read replica cannot yield stale or missing rows mid-update.
   */
  async #get(client: DbClient, id: string): Promise<SavedView | null> {
    const row = await client.oneOrNone(`SELECT * FROM ${this.#tableName()} WHERE "id" = $1`, [id]);
    return row ? rowToSavedView(row as Record<string, unknown>) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    if (await this.#get(this.#db.client, id)) {
      throw new Error(`Saved view "${id}" already exists`);
    }

    const now = new Date();
    await this.#db.insert({
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
    const created = await this.#get(this.#db.client, id);
    if (!created) throw new Error(`Failed to persist saved view "${id}".`);
    return created;
  }

  async update(id: string, patch: UpdateSavedViewInput): Promise<SavedView | null> {
    if (!(await this.#get(this.#db.client, id))) return null;

    const now = new Date();
    const data: Record<string, unknown> = { updatedAt: now, updatedAtZ: now };
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.state !== undefined) data.state = patch.state;
    if (patch.updatedById !== undefined) data.updatedById = patch.updatedById;

    await this.#db.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.#get(this.#db.client, id);
  }

  async delete(id: string): Promise<void> {
    await this.#db.client.none(`DELETE FROM ${this.#tableName()} WHERE "id" = $1`, [id]);
  }
}
