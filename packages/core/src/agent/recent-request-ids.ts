/**
 * Bounded memory of request ids a subscriber has already acted on.
 *
 * PubSub backends deliver at least once. A slow acknowledgement, an expired
 * ack deadline, or a redelivery after a crash all put the same message in front
 * of the subscriber again, so any handler that starts work or mutates state has
 * to be able to recognise a repeat of a request it already accepted.
 *
 * Ids are kept in insertion order and the oldest is evicted once `max` entries
 * are held, so a long-lived subscription cannot grow without bound. Eviction
 * only forgets an id — it never suppresses a first delivery, so the failure
 * mode of an undersized tracker is a redelivery that gets processed twice
 * rather than a delivery that gets dropped.
 */
export function createRecentRequestIds(max = 10_000) {
  const ids = new Set<string>();

  return {
    /** Records `id`, returning true the first time it is seen and false on every repeat. */
    remember(id: string): boolean {
      if (ids.has(id)) return false;
      ids.add(id);
      if (ids.size > max) {
        const oldest = ids.values().next().value;
        if (oldest !== undefined) ids.delete(oldest);
      }
      return true;
    },

    clear(): void {
      ids.clear();
    },

    get size(): number {
      return ids.size;
    },
  };
}
