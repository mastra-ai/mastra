import type {
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  SavedViewState,
  UpdateSavedViewInput,
} from '@mastra/core/storage';
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
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue } from '../../db/client';
import { buildSelectColumns } from '../../db/utils';

function parseJson(val: unknown, rowId: unknown): SavedViewState {
  if (typeof val !== 'string') return val as SavedViewState;
  try {
    return JSON.parse(val) as SavedViewState;
  } catch {
    throw new Error(`Saved view row "${String(rowId)}" has malformed JSON in column "state".`);
  }
}

function rowToSavedView(row: Record<string, any>): SavedView {
  return {
    id: String(row.id),
    page: String(row.page),
    name: String(row.name),
    authorId: row.authorId == null ? null : String(row.authorId),
    state: parseJson(row.state, row.id),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export class SavedViewsLibSQL extends SavedViewsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SAVED_VIEWS, schema: TABLE_SCHEMAS[TABLE_SAVED_VIEWS] });
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_saved_views_page_createdat ON "${TABLE_SAVED_VIEWS}" ("page", "createdAt")`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SAVED_VIEWS });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const params: InValue[] = [];
    let where = '';
    if (args.page !== undefined) {
      params.push(args.page);
      where = 'WHERE "page" = ?';
    }

    const countResult = await this.#client.execute({
      sql: `SELECT COUNT(*) as count FROM "${TABLE_SAVED_VIEWS}" ${where}`,
      args: params,
    });
    const total = Number(countResult.rows?.[0]?.count ?? 0);
    if (total === 0) {
      return { views: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
    }

    const limitValue = perPageInput === false ? total : perPage;
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SAVED_VIEWS)} FROM "${TABLE_SAVED_VIEWS}" ${where} ORDER BY "${orderBy.field}" ${orderBy.direction}, "id" ASC LIMIT ? OFFSET ?`,
      args: [...params, limitValue, offset],
    });

    return {
      views: result.rows.map(row => rowToSavedView(row as Record<string, any>)),
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : total > offset + perPage,
      },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SAVED_VIEWS)} FROM "${TABLE_SAVED_VIEWS}" WHERE "id" = ?`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? rowToSavedView(row as Record<string, any>) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date();
    // insertOnly: a plain INSERT so a duplicate id fails instead of
    // INSERT OR REPLACE silently overwriting the existing row.
    await this.#db.insertOnly({
      tableName: TABLE_SAVED_VIEWS,
      record: {
        id,
        page: input.page,
        name: input.name,
        authorId: input.authorId ?? null,
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

    await this.#db.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.#db.delete({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
  }
}
