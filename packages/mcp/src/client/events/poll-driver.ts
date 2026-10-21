import type { DeliveryDriver } from './mode';

/** Pages fetched back to back while draining a backlog before the poll floor applies again. */
export const MAX_DRAIN_PAGES = 10;

/** Delivers a subscription by repeating `events/poll`. A session only ends by throwing. */
export const pollDriver: DeliveryDriver = {
  mode: 'poll',
  async session(context) {
    const { port, options, signal } = context;
    let drained = 0;
    while (!signal.aborted) {
      const result = await port.poll(
        {
          name: context.name,
          ...(context.arguments ? { arguments: context.arguments } : {}),
          cursor: context.cursor,
          ...(options.maxAgeMs !== undefined ? { maxAgeMs: options.maxAgeMs } : {}),
          ...(options.maxEvents !== undefined ? { maxEvents: options.maxEvents } : {}),
        },
        signal,
      );
      if (signal.aborted) return;

      // The gap precedes this page's events, so record it before delivering them.
      if (result.truncated) context.markGap();
      for (const occurrence of result.events) context.deliver(occurrence);
      context.setPosition(result.cursor);
      context.established();

      // Drain a backlog immediately, but never spin on an empty "more" page, and let a server
      // that always reports more only skip the floor for a bounded number of pages.
      if (result.hasMore && result.events.length > 0 && drained < MAX_DRAIN_PAGES) {
        drained++;
        continue;
      }
      drained = 0;
      const floor = options.minPollIntervalMs;
      await context.sleep(Math.max(result.nextPollMs ?? floor, floor));
    }
  },
};
