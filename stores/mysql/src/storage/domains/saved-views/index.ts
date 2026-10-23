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

import type { StoreOperationsMySQL } from '../operations';
import { generateIndexSQL, generateTableSQL } from '../operations';
import { quoteIdentifier } from '../utils';

/** Maps a row already decoded by `operations.load` / `loadMany` (JSON parsed, timestamps as `Date`). */
function rowToSavedView(row: Record<string, unknown>): SavedView {
  return {
    id: String(row.id),
    page: String(row.page),
    name: String(row.name),
    authorId: row.authorId == null ? null : String(row.authorId),
    updatedById: row.updatedById == null ? null : String(row.updatedById),
    resourceId: row.resourceId == null ? null : String(row.resourceId),
    state: row.state as SavedViewState,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export class SavedViewsMySQL extends SavedViewsStorage {
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SAVED_VIEWS] as const;

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}idx_saved_views_page_createdat`,
        table: TABLE_SAVED_VIEWS,
        columns: ['page', 'createdAt'],
      },
    ];
  }

  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA }),
      ...SavedViewsMySQL.getDefaultIndexDefs().map(idx => generateIndexSQL(idx)),
    ];
  }

  constructor({
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (SavedViewsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_SAVED_VIEWS, schema: SAVED_VIEWS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return SavedViewsMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SAVED_VIEWS });
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    const conditions: string[] = [];
    const whereArgs: string[] = [];
    if (args.page !== undefined) {
      conditions.push(`${quoteIdentifier('page', 'column name')} = ?`);
      whereArgs.push(args.page);
    }
    if (args.resourceId !== undefined) {
      conditions.push(`${quoteIdentifier('resourceId', 'column name')} = ?`);
      whereArgs.push(args.resourceId);
    }
    const whereClause =
      conditions.length === 0 ? undefined : { sql: ` WHERE ${conditions.join(' AND ')}`, args: whereArgs };
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

    await this.operations.update({ tableName: TABLE_SAVED_VIEWS, keys: { id }, data });
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.operations.delete({ tableName: TABLE_SAVED_VIEWS, keys: { id } });
  }
}
