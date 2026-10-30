import type { SavedViewPage, SavedViewState } from '@mastra/core/storage';
import { createContext, useContext } from 'react';

/** A saved view as the host stores it. */
export type SavedViewRecord = {
  id: string;
  name: string;
  state: SavedViewState;
  updatedAt: string;
  /** `org`: shared by every project of the organization. Omitted: saved where it is listed. */
  scope?: 'org' | 'project';
};

/**
 * Where saved views are stored. The host supplies it (e.g. backed by its API), so the observability
 * pages show saved views only where the host supports them.
 */
export type SavedViewsSource = {
  /** The views of one page, newest-updated first. */
  list: (page: SavedViewPage) => Promise<SavedViewRecord[]>;
  /** Rejects with `SavedViewNameTakenError` when the name is already used. */
  create: (input: { name: string; state: SavedViewState }) => Promise<SavedViewRecord>;
  /** Rejects with `SavedViewNameTakenError` when the new name is already used. */
  update: (id: string, patch: { name?: string; state?: SavedViewState }) => Promise<SavedViewRecord>;
  remove: (id: string) => Promise<void>;
};

/** Thrown by a `SavedViewsSource` when a view with the same name already exists (e.g. on an HTTP 409). */
export class SavedViewNameTakenError extends Error {
  constructor(message = 'A saved view with this name already exists') {
    super(message);
    this.name = 'SavedViewNameTakenError';
  }
}

export type SavedViewsContextValue = { source: SavedViewsSource; queryKeyScope: readonly unknown[] };

export const SavedViewsContext = createContext<SavedViewsContextValue | undefined>(undefined);

export const useSavedViewsSource = () => useContext(SavedViewsContext);

export const savedViewsQueryKey = (queryKeyScope: readonly unknown[], page: SavedViewPage) => [
  'saved-views',
  ...queryKeyScope,
  page,
];
