import { calculatePagination, compareByField, normalizePerPage, resolveListOrderBy } from '../../base';
import type { InMemoryDB } from '../inmemory-db';
import {
  DEFAULT_SAVED_VIEW_ORDER_BY,
  DEFAULT_SAVED_VIEWS_PER_PAGE,
  SAVED_VIEW_ORDER_BY_FIELDS,
  SavedViewsStorage,
} from './base';
import type {
  CreateSavedViewInput,
  ListSavedViewsInput,
  ListSavedViewsOutput,
  SavedView,
  UpdateSavedViewInput,
} from './base';

export class InMemorySavedViewsStorage extends SavedViewsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.savedViews.clear();
  }

  async list(args: ListSavedViewsInput = {}): Promise<ListSavedViewsOutput> {
    let views = Array.from(this.db.savedViews.values());
    if (args.page !== undefined) views = views.filter(view => view.page === args.page);

    const orderBy = resolveListOrderBy(args.orderBy, SAVED_VIEW_ORDER_BY_FIELDS, DEFAULT_SAVED_VIEW_ORDER_BY);
    views.sort(compareByField(orderBy.field, orderBy.direction));

    const { page, perPage: perPageInput } = args.pagination ?? { page: 0, perPage: DEFAULT_SAVED_VIEWS_PER_PAGE };
    const perPage = normalizePerPage(perPageInput, DEFAULT_SAVED_VIEWS_PER_PAGE);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? views.length : start + perPage;

    return {
      views: views.slice(start, end).map(view => structuredClone(view)),
      pagination: {
        total: views.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : views.length > end,
      },
    };
  }

  async get(id: string): Promise<SavedView | null> {
    const view = this.db.savedViews.get(id);
    return view ? structuredClone(view) : null;
  }

  async create(input: CreateSavedViewInput): Promise<SavedView> {
    const id = input.id ?? crypto.randomUUID();
    if (this.db.savedViews.has(id)) {
      throw new Error(`Saved view "${id}" already exists`);
    }

    const now = new Date();
    const view: SavedView = {
      id,
      page: input.page,
      name: input.name,
      authorId: input.authorId ?? null,
      state: structuredClone(input.state),
      createdAt: now,
      updatedAt: now,
    };
    this.db.savedViews.set(id, view);
    return structuredClone(view);
  }

  async update(id: string, patch: UpdateSavedViewInput): Promise<SavedView | null> {
    const existing = this.db.savedViews.get(id);
    if (!existing) return null;

    const updated: SavedView = {
      ...existing,
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.state !== undefined && { state: structuredClone(patch.state) }),
      updatedAt: new Date(),
    };
    this.db.savedViews.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<void> {
    this.db.savedViews.delete(id);
  }
}
