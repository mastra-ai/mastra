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
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  SavedViewState,
  UpdateSavedViewInput,
} from '@mastra/core/storage';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { quoteIdentifier } from '../utils';

/** Maps a row already decoded by `operations.load` / `loadMany` (JSON parsed, timestamps as `Date`). */
function rowToSavedView(row: Record<string, unknown>): SavedView {
  return {
    id: String(row.id),
    page: String(row.page),
    name: String(row.name),
    authorId: row.authorId == null ? null : String(row.authorId),
    state: row.state as SavedViewState,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export class SavedViewsMySQL extends SavedViewsStorage {
  private operations: StoreOperationsMySQL;

  static readonly MANAGED_TABLES = [TABLE_SAVED_VIEWS] as const;

  static getExportDDL(): string[] {
    return [generateTableSQL({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA })];
  }

  constructor({ operations }: { operations: StoreOperationsMySQL }) {
    super();
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SAVED_VIEWS });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const whereClause =
      args.page === undefined
        ? undefined
        : { sql: ` WHERE ${quoteIdentifier('page', 'column name')} = ?`, args: [args.page] };
    const total = await this.operations.loadTotalCount({ tableName: TABLE_SAVED_VIEWS, whereClause });
    if (total === 0) {
      return { views: [], pagination: { total: 0, page, perPage: perPageForResponse, hasMore: false } };
    }

    const rows = await this.operations.loadMany<Record<string, unknown>>({
      tableName: TABLE_SAVED_VIEWS,
      whereClause,
      orderBy: `${quoteIdentifier(orderBy.field, 'column name')} ${orderBy.direction}, \`id\` ASC`,
      offset,
      limit: perPageInput === false ? total : perPage,
    });

    return {
      views: rows.map(row => rowToSavedView(row)),
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const row = await this.operations.load<Record<string, unknown>>({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
    return row ? rowToSavedView(row) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date();
    // insertOnly: a plain INSERT so a duplicate id fails instead of
    // ON DUPLICATE KEY UPDATE silently overwriting the existing row.
    await this.operations.insertOnly({
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

    await this.operations.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.operations.delete({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
  }
}
