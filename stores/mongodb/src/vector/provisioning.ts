import type { Document } from 'mongodb';

/** The driver types listSearchIndexes() rows as `{ name }`; these are the fields this store reads. */
export type SearchIndexRow = { name: string; id?: string; status?: string; latestDefinition?: Document };

/** Which protocol step lists a search index name (see `MongoDBVector.listSearchIndexRows`). */
export type ListPhase = 'P1' | 'P3a' | 'P5' | 'reconciler' | 'orphan' | 'claim' | 'delete';

/** What a call's P0 registry write left: the registration's lifetime and the call's rollback pin (I4). */
export interface P0Pin {
  generation: string;
  claimToken: string;
  rev: number;
}

/**
 * The update that undoes a P0 write of `written` over `previous` (§3.9): each field P0 wrote gets
 * its previous value back, or is removed when `previous` lacked it. Nothing else is touched.
 */
export function rollbackRestore(previous: Document, written: Document): { $set: Document; $unset: Record<string, ''> } {
  const $set: Document = {};
  const $unset: Record<string, ''> = {};
  for (const key of Object.keys(written)) {
    if (previous[key] === undefined) $unset[key] = '';
    else $set[key] = previous[key];
  }
  return { $set, $unset };
}
