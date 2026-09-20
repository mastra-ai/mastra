/**
 * Bounded memory of the requests a subscriber has already acted on, together with
 * whatever the first handling needs to leave behind for a repeat.
 *
 * PubSub backends deliver at least once, so the same request arrives again after
 * an acknowledgement that never landed, an ack deadline that expired while the
 * handler was still working, or a crash between handling and acking. A handler
 * that starts work or mutates state uses this to recognise the repeat.
 *
 * Keys are kept in insertion order and the oldest is evicted once `max` entries
 * are held, so a long-lived subscription cannot grow without bound. Eviction only
 * forgets an id — it never suppresses a first delivery, so an undersized store
 * reprocesses a request rather than dropping one.
 */
export function createRecentRequests<T>(max = 10_000) {
  const entries = new Map<string, T>();

  return {
    /** The value recorded for `id`, or undefined if it has never been seen. */
    get(id: string): T | undefined {
      return entries.get(id);
    },

    /** Records `id`. Callers check `get` first, so this only ever adds. */
    set(id: string, value: T): void {
      entries.set(id, value);
      if (entries.size > max) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },

    clear(): void {
      entries.clear();
    },

    get size(): number {
      return entries.size;
    },
  };
}
