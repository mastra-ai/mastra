import { z } from 'zod/v4';
import type { SavedViewRecord } from './saved-views-backend';

export const MAX_SAVED_VIEW_NAME_CHARS = 80;

export const savedViewNameSchema = z.string().trim().min(1).max(MAX_SAVED_VIEW_NAME_CHARS);

// Only `safeParse` is used, so the consumer's Zod version never has to match this package's.
export type SavedViewSchema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
};

/** A saved view: its name and the `state` it restores on the page, such as filters and table setup. */
export type SavedView<TState> = {
  id: string;
  name: string;
  state: TState;
};

/** Checks a stored view against the page's schema. A view that no longer parses is skipped on its own. */
export function parseSavedView<TState>(
  record: SavedViewRecord,
  schema: SavedViewSchema<TState>,
): SavedView<TState> | undefined {
  const name = savedViewNameSchema.safeParse(record.name);
  if (!name.success) return undefined;
  const state = schema.safeParse(record.state);
  if (!state.success) return undefined;
  return { id: record.id, name: name.data, state: state.data };
}

/** JSON with object keys sorted, so two values compare equal whatever order a database returned their keys in. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) return nested;
    return Object.fromEntries(Object.entries(nested).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  });
}

/** Whether two states are the same JSON, whatever the key order. */
export function sameSavedViewState<TState>(current: TState, saved: TState): boolean {
  return stableStringify(current) === stableStringify(saved);
}
