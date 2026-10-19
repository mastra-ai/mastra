import type { DeliveryDriver } from './mode';

/** Delivers a subscription by repeating `events/poll`. A session only ends by throwing. */
export const pollDriver: DeliveryDriver = {
  mode: 'poll',
  async session(context) {
    const { port, options, signal } = context;
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

      // Drain a backlog immediately, but never spin on an empty "more" page.
      if (result.hasMore && result.events.length > 0) continue;
      const floor = options.minPollIntervalMs;
      await context.sleep(Math.max(result.nextPollMs ?? floor, floor));
    }
  },
};
