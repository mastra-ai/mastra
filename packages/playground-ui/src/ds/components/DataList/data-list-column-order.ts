import { z } from 'zod/v4';
import { splitColumns } from './shared';

export const columnOrderSchema = z.array(z.number().int().nonnegative());

export const getColumnOrderStorageKey = (id: string) => `mastra:data-list:column-order:${id}`;

/** Tracks of a grid template, or `null` when it uses `repeat()` (track count unknown). */
export function splitGridTracks(columns: string): string[] | null {
  const tracks = splitColumns(columns);
  return tracks.some(track => track.startsWith('repeat(')) ? null : tracks;
}

export const identityOrder = (count: number) => Array.from({ length: count }, (_, i) => i);

/** Returns `stored` when it is a permutation of `0..count-1`, otherwise the identity order. */
export function normalizeOrder(stored: number[] | undefined, count: number): number[] {
  if (!stored || stored.length !== count) return identityOrder(count);
  const seen = new Set(stored);
  if (seen.size !== count || stored.some(i => i >= count)) return identityOrder(count);
  return stored;
}

export const keyedColumnOrderSchema = z.array(z.string());

/**
 * Maps a stored key order onto the current columns. Stored keys that are not
 * rendered are skipped; columns missing from the stored order (newly added)
 * are inserted at their default position. Returns column indexes in visual order.
 */
export function resolveKeyedOrder(stored: string[] | undefined, keys: string[]): number[] {
  const current = new Set(keys);
  const visual = (stored ?? []).filter((key, i, all) => current.has(key) && all.indexOf(key) === i);
  const placed = new Set(visual);
  keys.forEach((key, index) => {
    if (!placed.has(key)) visual.splice(Math.min(index, visual.length), 0, key);
  });
  return visual.map(key => keys.indexOf(key));
}

/**
 * Moves a visible column and returns the next stored key order. Keys of columns
 * that are not rendered right now are kept at the end so they are not forgotten.
 */
export function moveKeyedOrder(stored: string[] | undefined, keys: string[], from: number, to: number): string[] {
  const visual = moveIndex(resolveKeyedOrder(stored, keys), from, to).map(i => keys[i] ?? '');
  const visible = new Set(keys);
  return [...visual, ...(stored ?? []).filter(key => !visible.has(key))];
}

/** Moves the item at visual position `from` to visual position `to`. */
export function moveIndex(order: number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
