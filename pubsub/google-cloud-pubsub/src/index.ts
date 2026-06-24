import { PubSub as PubSubClient } from '@google-cloud/pubsub';
import type { ClientConfig, Message, Subscription } from '@google-cloud/pubsub';
import { PubSub } from '@mastra/core/events';
import type { Event, EventCallback, SubscribeOptions } from '@mastra/core/events';

export class GoogleCloudPubSub extends PubSub {
  private instanceId: string;
  private pubsub: PubSubClient;
  private ackBuffer: Record<string, Promise<any>> = {};
  private activeSubscriptions: Record<string, Subscription> = {};
  private activeCbs: Record<string, Set<EventCallback>> = {};
  // `localOnly` publishes never touch Google Cloud — they are delivered to
  // same-process subscribers only. Tracks live callbacks per (normalized) topic
  // so we can fan out without going through PubSub.
  private localCallbacks: Map<string, Set<EventCallback>> = new Map();
  // Coalesces concurrent init() calls for the same subscription so racing
  // subscribers (e.g. a producer stream and a consumer observe on the same
  // run topic) share a single createTopic/createSubscription attempt.
  private inFlightInit: Record<string, Promise<Subscription | undefined>> = {};
  // Tracks the actual anonymous message listener registered on each subscription,
  // so we can remove it cleanly on the final unsubscribe.
  private messageListeners: Record<string, (message: Message) => void> = {};

  constructor(config: ClientConfig) {
    super();
    this.pubsub = new PubSubClient(config);
    this.instanceId = crypto.randomUUID();
  }

  getSubscriptionName(topic: string, group?: string) {
    if (group) {
      return `${topic}-${group}`;
    }
    return `${topic}-${this.instanceId}`;
  }

  async ackMessage(topic: string, message: Message) {
    try {
      const ackResponse = Promise.race([message.ackWithResponse(), new Promise(resolve => setTimeout(resolve, 5000))]);
      this.ackBuffer[topic + '-' + message.id] = ackResponse.catch(() => {});
      await ackResponse;
      delete this.ackBuffer[topic + '-' + message.id];
    } catch (e) {
      console.error('Error acking message', e);
    }
  }

  async init(topicName: string, group?: string): Promise<Subscription | undefined> {
    const subscriptionKey = group ? `${topicName}:${group}` : topicName;

    // Reuse an in-flight init so concurrent subscribers don't race to create the
    // same subscription. The promise is registered synchronously below (before any
    // await), so a second caller arriving during the create window reuses it.
    if (this.inFlightInit[subscriptionKey]) {
      return this.inFlightInit[subscriptionKey];
    }

    const subscriptionName = this.getSubscriptionName(topicName, group);
    const initPromise = (async (): Promise<Subscription | undefined> => {
      try {
        await this.pubsub.createTopic(topicName);
      } catch {
        // no-op
      }
      try {
        const [sub] = await this.pubsub.topic(topicName).createSubscription(subscriptionName, {
          enableMessageOrdering: true,
          enableExactlyOnceDelivery: topicName === 'workflows' || !!group,
        });
        this.activeSubscriptions[subscriptionKey] = sub;
        return sub;
      } catch (error) {
        // The subscription may already exist: created concurrently by a racing
        // subscriber (ALREADY_EXISTS / gRPC code 6), shared by another process via
        // a group, or surviving a previous process. In all of these cases attach to
        // the existing subscription instead of failing. Ungrouped subscriptions hit
        // this on the concurrent-create race, so we must not gate it on `group`.
        const alreadyExists = (error as { code?: number } | undefined)?.code === 6;
        if (alreadyExists || group) {
          try {
            const sub = this.pubsub.subscription(subscriptionName);
            this.activeSubscriptions[subscriptionKey] = sub;
            return sub;
          } catch {
            // no-op
          }
        }
      }
      return undefined;
    })().finally(() => {
      delete this.inFlightInit[subscriptionKey];
    });

    this.inFlightInit[subscriptionKey] = initPromise;
    return initPromise;
  }

  async destroy(topicName: string) {
    const subName = this.getSubscriptionName(topicName);
    delete this.activeSubscriptions[topicName];
    this.pubsub.subscription(subName).removeAllListeners();
    await this.pubsub.subscription(subName).close();
    await this.pubsub.subscription(subName).delete();
    await this.pubsub.topic(topicName).delete();
  }

  async publish(
    topicName: string,
    event: Omit<Event, 'id' | 'createdAt'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    if (topicName.startsWith('workflow.events.')) {
      const parts = topicName.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topicName = 'workflow.events.v2';
      } else {
        topicName = 'workflow.events.v1';
      }
    }

    // `localOnly` events stay entirely within the publishing process. They are
    // never serialized through Google Cloud, so live methods on payload values
    // (e.g. `MastraModelOutput.getFullOutput`) survive intact. The agent's
    // execution-workflow relies on this: the run result is delivered via
    // `workflows-finish` and includes the `MastraModelOutput` instance —
    // round-tripping it through Pub/Sub would strip its methods.
    if (options?.localOnly) {
      await this.deliverLocal(topicName, event);
      return;
    }

    let topic = this.pubsub.topic(topicName);

    try {
      await topic.publishMessage({
        data: Buffer.from(JSON.stringify(event)),
        orderingKey: 'workflows',
      });
    } catch (e: any) {
      if (e.code === 5) {
        await this.pubsub.createTopic(topicName);
        await this.publish(topicName, event);
      } else {
        throw e;
      }
    }
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (topic.startsWith('workflow.events.')) {
      const parts = topic.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topic = 'workflow.events.v2';
      } else {
        topic = 'workflow.events.v1';
      }
    }

    const group = options?.group;
    // Use a composite key when group is set so grouped and non-grouped subscriptions
    // on the same topic don't collide
    const subscriptionKey = group ? `${topic}:${group}` : topic;

    // Register callback for `localOnly` delivery. Local delivery bypasses Google
    // Cloud entirely so live class instances on the payload (e.g. Date, Map,
    // Error, MastraModelOutput) keep their prototypes.
    let localSet = this.localCallbacks.get(topic);
    if (!localSet) {
      localSet = new Set();
      this.localCallbacks.set(topic, localSet);
    }
    localSet.add(cb);

    // Update tracked callbacks
    const subscription = this.activeSubscriptions[subscriptionKey] ?? (await this.init(topic, group));
    if (!subscription) {
      throw new Error(`Failed to subscribe to topic: ${topic}`);
    }

    this.activeSubscriptions[subscriptionKey] = subscription;

    const activeCbs = this.activeCbs[subscriptionKey] ?? new Set();
    activeCbs.add(cb);
    this.activeCbs[subscriptionKey] = activeCbs;

    if (subscription.isOpen) {
      return;
    }

    const messageListener = async (message: Message) => {
      const event = JSON.parse(message.data.toString()) as Event;
      event.id = message.id;
      event.createdAt = message.publishTime;
      event.deliveryAttempt = message.deliveryAttempt ?? 1;

      try {
        const activeCbs = this.activeCbs[subscriptionKey] ?? [];
        for (const cb of activeCbs) {
          cb(
            event,
            async () => {
              try {
                await this.ackMessage(subscriptionKey, message);
              } catch (e) {
                console.error('Error acking message', e);
              }
            },
            async () => {
              try {
                message.nack();
              } catch (e) {
                console.error('Error nacking message', e);
              }
            },
          );
        }
      } catch (error) {
        console.error('Error processing event', error);
      }
    };

    this.messageListeners[subscriptionKey] = messageListener;
    subscription.on('message', messageListener);

    subscription.on('error', async error => {
      console.error('subscription error', error);
    });
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    if (topic.startsWith('workflow.events.')) {
      const parts = topic.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topic = 'workflow.events.v2';
      } else {
        topic = 'workflow.events.v1';
      }
    }

    // Drop from the local-delivery set; if nobody is left, tear down the bucket.
    const localSet = this.localCallbacks.get(topic);
    if (localSet?.delete(cb) && localSet.size === 0) {
      this.localCallbacks.delete(topic);
    }

    // Check both grouped and non-grouped subscription keys for this callback
    const keysToCheck = [topic];
    for (const key of Object.keys(this.activeCbs)) {
      if (key.startsWith(`${topic}:`) && !keysToCheck.includes(key)) {
        keysToCheck.push(key);
      }
    }

    for (const subscriptionKey of keysToCheck) {
      const activeCbs = this.activeCbs[subscriptionKey];
      if (activeCbs?.has(cb)) {
        activeCbs.delete(cb);

        if (activeCbs.size === 0) {
          const subscription = this.activeSubscriptions[subscriptionKey];
          const listener = this.messageListeners[subscriptionKey];
          if (subscription) {
            if (listener) subscription.removeListener('message', listener);
            await subscription.close();
          }
          delete this.activeSubscriptions[subscriptionKey];
          delete this.activeCbs[subscriptionKey];
          delete this.messageListeners[subscriptionKey];
        }
        return;
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.all(Object.values(this.ackBuffer));
  }

  /**
   * Fan a `localOnly` event out to in-process subscribers without going through
   * Google Cloud. The payload is delivered by reference, so live class instances
   * and functions on the event survive intact.
   */
  private async deliverLocal(topicName: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const callbacks = this.localCallbacks.get(topicName);
    if (!callbacks || callbacks.size === 0) return;

    const localEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      deliveryAttempt: 1,
    };

    for (const cb of [...callbacks]) {
      try {
        cb(
          localEvent,
          async () => {},
          async () => {},
        );
      } catch (error) {
        console.error('Error delivering local event', error);
      }
    }
  }
}
