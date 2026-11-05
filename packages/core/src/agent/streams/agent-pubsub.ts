import { PubSub } from '../../events/pubsub';

const bindings = new WeakMap<PubSub, { agentId: string; inner: PubSub }>();
const views = new WeakMap<PubSub, Map<string, PubSub>>();
const topicMethods = new Set([
  'publish',
  'subscribe',
  'unsubscribe',
  'getHistory',
  'subscribeWithReplay',
  'subscribeFromOffset',
  'clearTopic',
  'trimTopic',
]);
const prefixes = ['agent.stream.', 'agent.control.', 'agent.abort-ack.'];

/** @internal Bind agent delivery after cache resolution, so cache keys and transport topics share the same scope. */
export function bindAgentPubSub<T extends PubSub>(pubsub: T, agentId: string): T {
  const binding = bindings.get(pubsub) ?? bindings.get(pubsub.__self());
  if (binding?.agentId === agentId) return pubsub;
  if (binding && !bindings.has(pubsub)) {
    throw new Error('Cannot rebind an agent transport through an ownership decorator');
  }
  const inner = binding?.inner ?? pubsub;
  const existing = views.get(inner)?.get(agentId);
  if (existing) return existing as T;
  const methods = new Map<PropertyKey, unknown>();
  const view = new Proxy(Object.create(PubSub.prototype) as T, {
    get(_target, property) {
      if (property === '__self') return () => view;
      if (methods.has(property)) return methods.get(property);
      const value = Reflect.get(inner, property, inner);
      if (typeof value !== 'function') return value;
      const method =
        typeof property === 'string' && topicMethods.has(property)
          ? (topic: string, ...args: unknown[]) => {
              const prefix = prefixes.find(prefix => topic.startsWith(prefix));
              const scopedTopic = prefix
                ? `${prefix}v2.${JSON.stringify([agentId, topic.slice(prefix.length)])}`
                : topic;
              return value.call(inner, scopedTopic, ...args);
            }
          : value.bind(inner);
      methods.set(property, method);
      return method;
    },
    has(_target, property) {
      return property in inner;
    },
  });
  bindings.set(view, { agentId, inner });
  const agentViews = views.get(inner) ?? new Map<string, PubSub>();
  agentViews.set(agentId, view);
  views.set(inner, agentViews);
  return view;
}
