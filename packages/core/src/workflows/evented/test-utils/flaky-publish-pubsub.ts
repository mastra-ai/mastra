import type { PubSub } from '../../../events/pubsub';

/**
 * Wraps a real PubSub so `publish()` rejects for chosen event types on the
 * `workflows` topic, a fixed number of times per type. Everything else is
 * forwarded to the wrapped transport unchanged.
 */
export function createFlakyPublishPubSub<T extends Pick<PubSub, 'publish'>>(
  inner: T,
  failures: Record<string, number>,
  matches: (event: Parameters<PubSub['publish']>[1]) => boolean = () => true,
) {
  const remaining = { ...failures };
  const attempts: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  const pubsub = new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: { type: string }, options?: { localOnly?: boolean }) => {
          if (topic === 'workflows' && event.type in remaining && matches(event as Parameters<PubSub['publish']>[1])) {
            attempts[event.type] = (attempts[event.type] ?? 0) + 1;
            if (remaining[event.type]! > 0) {
              remaining[event.type]!--;
              rejected[event.type] = (rejected[event.type] ?? 0) + 1;
              throw new Error(`injected publish failure for ${event.type}`);
            }
          }
          return target.publish(topic, event as any, options);
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { pubsub, attempts, rejected };
}
