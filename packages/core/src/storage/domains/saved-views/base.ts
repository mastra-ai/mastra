import type { ListOrderBy, PaginationInfo, StoragePagination } from '../../types';
import { StorageDomain } from '../base';

/**
 * What a saved view restores, for example the traces page's filters, time
 * range, sort and columns.
 *
 * The UI owns the full shape. Storage only relies on the integer `version`,
 * so adding a filter field or table setting never needs a storage change.
 */
export type SavedViewState = { version: number } & Record<string, unknown>;

/**
 * A named, shared setup for a Studio page (for example the traces table).
 *
 * Everyone who can open Studio sees every view, and anyone who can write can
 * edit it. `authorId` records who created it and `updatedById` who last
 * changed it.
 */
export interface SavedView {
  id: string;
  /** Page the view belongs to, for example `'traces'`. */
  page: string;
  name: string;
  /** Who created the view. `null` when the server runs without auth. */
  authorId: string | null;
  /** Who last changed the view, starting as `authorId`. `null` when the server runs without auth. */
  updatedById: string | null;
  /**
   * Tenant the view belongs to when the server scopes stored resources
   * (`server.storedResources.scope`). `null` otherwise.
   */
  resourceId: string | null;
  /** What the view restores on its page. */
  state: SavedViewState;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a saved view. A missing `id` is generated, and `updatedById` starts as `authorId`. */
export interface CreateSavedViewInput {
  id?: string;
  page: string;
  name: string;
  authorId?: string | null;
  resourceId?: string | null;
  state: SavedViewState;
}

/** Fields that can change on a saved view. Omitted fields keep their value. */
export interface UpdateSavedViewInput {
  name?: string;
  state?: SavedViewState;
  /** Who is making this change. */
  updatedById?: string | null;
}

export type SavedViewOrderByField = 'createdAt' | 'updatedAt' | 'name';

export interface ListSavedViewsInput {
  /** Only return views for this page. Omit to list views for every page. */
  page?: string;
  /** Only return views for this tenant. Omit to list views for every tenant. */
  resourceId?: string;
  /** Defaults to the first 100 views. */
  pagination?: StoragePagination;
  /** Defaults to `createdAt ASC`, so new views come last. Ties are broken by `id ASC`. */
  orderBy?: ListOrderBy<SavedViewOrderByField>;
}

export interface ListSavedViewsOutput {
  views: SavedView[];
  pagination: PaginationInfo;
}

export const SAVED_VIEW_ORDER_BY_FIELDS: readonly SavedViewOrderByField[] = ['createdAt', 'updatedAt', 'name'];
export const DEFAULT_SAVED_VIEW_ORDER_BY = { field: 'createdAt', direction: 'ASC' } as const satisfies {
  field: SavedViewOrderByField;
  direction: 'ASC' | 'DESC';
};
export const DEFAULT_SAVED_VIEWS_PER_PAGE = 100;

/**
 * Storage domain for saved views.
 */
export abstract class SavedViewsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'SAVED_VIEWS' });
  }

  abstract list(args?: ListSavedViewsInput): Promise<ListSavedViewsOutput>;
  abstract get(id: string): Promise<SavedView | null>;
  abstract create(input: CreateSavedViewInput): Promise<SavedView>;
  /** Returns `null` when no view has this id. */
  abstract update(id: string, patch: UpdateSavedViewInput): Promise<SavedView | null>;
  /** Deleting a missing view is a no-op. */
  abstract delete(id: string): Promise<void>;
}
