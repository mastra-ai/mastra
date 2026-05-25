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

  async init(topicName: string, group?: string) {
    try {
      await this.pubsub.createTopic(topicName);
    } catch {
      // no-op
    }
    const subscriptionName = this.getSubscriptionName(topicName, group);
    const subscriptionKey = group ? `${topicName}:${group}` : topicName;
    try {
      const [sub] = await this.pubsub.topic(topicName).createSubscription(subscriptionName, {
        enableMessageOrdering: true,
        enableExactlyOnceDelivery: topicName === 'workflows' || !!group,
      });
      this.activeSubscriptions[subscriptionKey] = sub;
      return sub;
    } catch {
      // Subscription may already exist (e.g. shared group subscription created by another process).
      // Get the existing subscription instead.
      if (group) {
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
  }

  async destroy(topicName: string) {
    const subName = this.getSubscriptionName(topicName);
    delete this.activeSubscriptions[topicName];
    this.pubsub.subscription(subName).removeAllListeners();
    await this.pubsub.subscription(subName).close();
    await this.pubsub.subscription(subName).delete();
    await this.pubsub.topic(topicName).delete();
  }

  async publish(topicName: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (topicName.startsWith('workflow.events.')) {
      const parts = topicName.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topicName = 'workflow.events.v2';
      } else {
        topicName = 'workflow.events.v1';
      }
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
}
