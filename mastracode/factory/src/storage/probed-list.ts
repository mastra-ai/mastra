import type { CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

// Equal stamps must mean an unchanged list.
export interface Probe {
  stamp: string;
  newestAt: number;
}

const TTL_MS = 60_000;
// A row written in the last seconds may race the probe.
const SETTLE_MS = 5_000;
const MAX_KEYS = 100;

// Held arrays are frozen and shared between callers.
export class ProbedList<T> {
  readonly #held = new Map<string, { stamp: string; takenAt: number; rows: Promise<readonly T[]> }>();

  async read(
    key: string,
    probe: () => Promise<Probe | undefined>,
    load: () => Promise<readonly T[]>,
  ): Promise<readonly T[]> {
    const found = await probe();
    if (!found) {
      this.#held.delete(key);
      return load();
    }
    const now = Date.now();
    const hit = this.#held.get(key);
    if (hit?.stamp === found.stamp && now - hit.takenAt < TTL_MS && now - found.newestAt >= SETTLE_MS) {
      return hit.rows;
    }
    const entry = { stamp: found.stamp, takenAt: now, rows: load().then(rows => Object.freeze(rows)) };
    this.#held.delete(key);
    this.#held.set(key, entry);
    if (this.#held.size > MAX_KEYS) {
      const oldest = this.#held.keys().next();
      if (!oldest.done) this.#held.delete(oldest.value);
    }
    try {
      return await entry.rows;
    } catch (error) {
      if (this.#held.get(key) === entry) this.#held.delete(key);
      throw error;
    }
  }
}

export async function probeNewest(
  ops: FactoryStorageOps,
  collection: string,
  where: CollectionWhere,
  column: 'created_at' | 'updated_at',
): Promise<Probe | undefined> {
  if (!ops.count) return undefined;
  const [count, [newest]] = await Promise.all([
    ops.count(collection, where),
    ops.findMany<{ id: string; created_at?: Date; updated_at?: Date }>(collection, where, {
      orderBy: [
        [column, 'desc'],
        ['id', 'desc'],
      ],
      limit: 1,
    }),
  ]);
  const at = newest?.[column]?.getTime() ?? 0;
  return { stamp: `${count}:${newest?.id ?? ''}:${at}`, newestAt: at };
}
