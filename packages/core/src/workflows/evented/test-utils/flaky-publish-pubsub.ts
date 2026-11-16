import type { PubSub } from '../../../events/pubsub';

/**
 * Wraps a real PubSub so `publish()` rejects for chosen event types on the
 * `workflows` topic, a fixed number of times per type. Everything else is
 * forwarded to the wrapped transport unchanged.
 */
export function createFlakyPublishPubSub(inner: PubSub, failures: Record<string, number>) {
  const remaining = { ...failures };
  const attempts: Record<string, number> = {};
  const rejected: Record<string, number> = {};
  /** `data.workflowId` of each attempt, per event type. */
  const attemptWorkflowIds: Record<string, string[]> = {};
  const pubsub = new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (
          topic: string,
          event: { type: string; data?: { workflowId?: string } },
          options?: { localOnly?: boolean },
        ) => {
          if (topic === 'workflows' && event.type in remaining) {
            attempts[event.type] = (attempts[event.type] ?? 0) + 1;
            (attemptWorkflowIds[event.type] ??= []).push(event.data?.workflowId ?? '');
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
  return { pubsub, attempts, rejected, attemptWorkflowIds };
}
