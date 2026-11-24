/**
 * Lets a test stop a Mastra instance the way a crash stops a process: from
 * `kill()` on, nothing it sends reaches the store or the pubsub, and no event
 * reaches it. Its timers keep firing in the test process, but every write they
 * make hangs, so its leases lapse one TTL after its last renewal, as a dead
 * process's do. `revive()` lets the instance talk again, for the test's own
 * cleanup.
 */
import type { PubSub } from '../../events/pubsub';
import type { Event, EventCallback } from '../../events/types';
import type { MastraCompositeStore } from '../../storage/base';

/** A promise that never settles: what a call to a dead process waits for. */
const never = () => new Promise<never>(() => {});

/** Wraps `target` so every method call hangs while `isDead()` is true. */
function hangWhileDead<T extends object>(target: T, isDead: () => boolean): T {
  return new Proxy(target, {
    get(object, prop) {
      const value = Reflect.get(object, prop, object);
      if (typeof value !== 'function') {
        return value;
      }

      return (...args: unknown[]) => (isDead() ? never() : value.apply(object, args));
    },
  });
}

/**
 * The store and pubsub one instance uses, and the switch that kills it.
 * `storage` is the store the instance would use on its own, `pubsub` its
 * connection to the events.
 */
export function killableProcess({ storage, pubsub }: { storage: MastraCompositeStore; pubsub: PubSub }) {
  let dead = false;
  const isDead = () => dead;
  const domains = new Map<string, unknown>();

  const processStorage = new Proxy(storage, {
    get(object, prop) {
      if (prop === 'getStore') {
        return async (name: string) => {
          if (dead) {
            return never();
          }

          const domain = await object.getStore(name as never);
          if (!domain) {
            return domain;
          }

          if (!domains.has(name)) {
            domains.set(name, hangWhileDead(domain as object, isDead));
          }

          return domains.get(name);
        };
      }

      const value = Reflect.get(object, prop, object);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });

  // Each callback the instance subscribes is wrapped once, so its unsubscribe finds the same wrapper.
  const wrapped = new Map<EventCallback, EventCallback>();
  const processPubsub = new Proxy(pubsub, {
    get(object, prop) {
      if (prop === 'publish') {
        return (topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) =>
          dead ? never() : object.publish(topic, event, options);
      }

      if (prop === 'subscribe') {
        return (topic: string, cb: EventCallback, options?: unknown) => {
          let deliver = wrapped.get(cb);
          if (!deliver) {
            // A dead process never sees an event, nor acknowledges one.
            deliver = ((event, ack) => (dead ? undefined : cb(event, ack))) as EventCallback;
            wrapped.set(cb, deliver);
          }

          return object.subscribe(topic, deliver, options as never);
        };
      }

      if (prop === 'unsubscribe') {
        return (topic: string, cb: EventCallback) => object.unsubscribe(topic, wrapped.get(cb) ?? cb);
      }

      const value = Reflect.get(object, prop, object);
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });

  return {
    storage: processStorage,
    pubsub: processPubsub,
    kill: () => {
      dead = true;
    },
    revive: () => {
      dead = false;
    },
  };
}
