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
  SavedViewState,
  UpdateSavedViewInput,
} from '@mastra/core/storage';
import type sql from 'mssql';

import { MssqlDB, resolveMssqlConfig } from '../../db';
import type { MssqlDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

function parseState(value: unknown, rowId: unknown): SavedViewState {
  if (typeof value !== 'string') return value as SavedViewState;
  try {
    return JSON.parse(value) as SavedViewState;
  } catch {
    throw new Error(`Saved view row "${String(rowId)}" has malformed JSON in column "state".`);
  }
}

function rowToSavedView(row: Record<string, unknown>): SavedView {
  return {
    id: String(row.id),
    page: String(row.page),
    name: String(row.name),
    authorId: row.authorId == null ? null : String(row.authorId),
    updatedById: row.updatedById == null ? null : String(row.updatedById),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    state: parseState(row.state, row.id),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
  };
}

export class SavedViewsMSSQL extends SavedViewsStorage {
  private pool: sql.ConnectionPool;
  private schema?: string;
  private db: MssqlDB;
  private needsConnect: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SAVED_VIEWS] as const;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.schema = schemaName;
    this.db = new MssqlDB({ pool, schemaName, skipDefaultIndexes });
    this.needsConnect = needsConnect;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (SavedViewsMSSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  private getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema && this.schema !== 'dbo' ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_saved_views_page_createdat_idx`,
        table: TABLE_SAVED_VIEWS,
        columns: ['page', 'createdAt'],
      },
    ];
  }

  private async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  private async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SAVED_VIEWS });
  }

  #tableName(): string {
    return getTableName({ indexName: TABLE_SAVED_VIEWS, schemaName: getSchemaName(this.schema) });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const tableName = this.#tableName();

    const conditions: string[] = [];
    const params: Record<string, string> = {};
    if (args.page !== undefined) {
      params.page = args.page;
      conditions.push('[page] = @page');
    }
    if (args.resourceId !== undefined) {
      params.resourceId = args.resourceId;
      conditions.push('[resourceId] = @resourceId');
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const request = () => {
      const req = this.pool.request();
      for (const [name, value] of Object.entries(params)) req.input(name, value);
      return req;
    };

    const countResult = await request().query(`SELECT COUNT(*) AS count FROM ${tableName} ${where}`);
    const total = Number(countResult.recordset[0]?.count ?? 0);
    const hasMore = perPageInput === false ? false : total > offset + perPage;
    // `FETCH NEXT 0 ROWS` is a syntax error in SQL Server, so an empty page is answered here.
    if (total === 0 || perPage === 0) {
      return { views: [], pagination: { total, page, perPage: perPageForResponse, hasMore } };
    }

    const listRequest = request();
    listRequest.input('offset', offset);
    let fetch = '';
    if (perPageInput !== false) {
      listRequest.input('limit', perPage);
      fetch = 'FETCH NEXT @limit ROWS ONLY';
    }
    const result = await listRequest.query(
      `SELECT * FROM ${tableName} ${where} ORDER BY [${orderBy.field}] ${orderBy.direction}, [id] ASC OFFSET @offset ROWS ${fetch}`,
    );

    return {
      views: (result.recordset as Record<string, unknown>[]).map(rowToSavedView),
      pagination: { total, page, perPage: perPageForResponse, hasMore },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const row = await this.db.load<Record<string, unknown>>({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
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

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.state !== undefined) data.state = patch.state;
    if (patch.updatedById !== undefined) data.updatedById = patch.updatedById;

    await this.db.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const request = this.pool.request();
    request.input('id', id);
    await request.query(`DELETE FROM ${this.#tableName()} WHERE [id] = @id`);
  }
}
