// Compiled on its own (`pnpm test`), since adding payload types here would
// fail the check that every typed event type has a runtime list.
import { expectTypeOf } from 'vitest';

import { ConnectEvents, ConnectEventWorker } from '../../src/index.js';

declare module '../../src/event-payloads/index.js' {
  interface ConnectEventPayloads {
    acme: { 'order.created': { orderId: string } };
  }
}

declare module '../../src/event-payloads/github.generated.js' {
  interface GithubWebhookPayloads {
    'brand_new.created': { brandNew: true };
  }
}

// `true` doesn't filter a provider added with `declare module` by event type,
// so its payload stays untyped.
for await (const event of new ConnectEvents({ events: { acme: true } })) {
  expectTypeOf(event.provider).toEqualTypeOf<'acme'>();
  expectTypeOf(event.eventType).toEqualTypeOf<string>();
  expectTypeOf(event.payload).toBeUnknown();
}

// Listing its event types delivers typed payloads.
for await (const event of new ConnectEvents({ events: { acme: ['order.created'] } })) {
  expectTypeOf(event.payload.orderId).toBeString();
}

// `true` for a shipped provider only delivers the event types Connect ships,
// so an event type added with `declare module` isn't in it until listed.
for await (const event of new ConnectEvents({ events: { github: true } })) {
  expectTypeOf(event.eventType).not.toEqualTypeOf<string>();
  // @ts-expect-error -- not delivered by `true`
  if (event.eventType === 'brand_new.created') void event;
}
for await (const event of new ConnectEvents({ events: { github: ['brand_new.created'] } })) {
  expectTypeOf(event.payload.brandNew).toEqualTypeOf<true>();
}

// The same goes for ConnectEventWorker handlers.
new ConnectEventWorker({
  acme: ({ event }) => {
    expectTypeOf(event.payload).toBeUnknown();
  },
});
new ConnectEventWorker({
  acme: {
    'order.created': ({ event }) => {
      expectTypeOf(event.payload.orderId).toBeString();
    },
  },
});
