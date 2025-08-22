import { PubSub as PubSubClient } from '@google-cloud/pubsub';
import type { ClientConfig, Message, Subscription } from '@google-cloud/pubsub';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';

export class GoogleCloudPubSub extends PubSub {
  private instanceId: string;
  private pubsub: PubSubClient;
  private ackBuffer: Record<string, Promise<any>> = {};
  private activeSubscriptions: Record<string, Subscription> = {};
  private activeCbs: Record<string, Set<(event: Event, ack: () => Promise<void>) => void>> = {};

  constructor(config: ClientConfig) {
    super();
    this.pubsub = new PubSubClient(config);
    this.instanceId = crypto.randomUUID();
  }

  getSubscriptionName(topic: string) {
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

  async init(topicName: string) {
    try {
      await this.pubsub.createTopic(topicName);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // no-op
    }
    try {
      const [sub] = await this.pubsub.topic(topicName).createSubscription(this.getSubscriptionName(topicName), {
        enableMessageOrdering: true,
        enableExactlyOnceDelivery: topicName === 'workflows' ? true : false,
      });
      this.activeSubscriptions[topicName] = sub;
      return sub;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // no-op
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

  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    if (topic.startsWith('workflow.events.')) {
      const parts = topic.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topic = 'workflow.events.v2';
      } else {
        topic = 'workflow.events.v1';
      }
    }

    // Update tracked callbacks
    const subscription = this.activeSubscriptions[topic] ?? (await this.init(topic));
    if (!subscription) {
      throw new Error(`Failed to subscribe to topic: ${topic}`);
    }

    this.activeSubscriptions[topic] = subscription;

    const activeCbs = this.activeCbs[topic] ?? new Set();
    activeCbs.add(cb);
    this.activeCbs[topic] = activeCbs;

    if (subscription.isOpen) {
      return;
    }

    subscription.on('message', async message => {
      const event = JSON.parse(message.data.toString()) as Event;
      event.id = message.id;
      event.createdAt = message.publishTime;

      try {
        const activeCbs = this.activeCbs[topic] ?? [];
        for (const cb of activeCbs) {
          cb(event, async () => {
            try {
              await this.ackMessage(topic, message);
            } catch (e) {
              console.error('Error acking message', e);
            }
          });
        }
      } catch (error) {
        console.error('Error processing event', error);
      }
    });

    subscription.on('error', async error => {
      // if (error.code === 5) {
      //   await this.init(topic);
      // } else {
      //   // TODO: determine if other errors require re-subscription
      //   // console.error('subscription error, retrying in 5 seconds', error);
      //   // await new Promise(resolve => setTimeout(resolve, 5000));
      //   // await this.subscribe(topic, cb);
      //   console.error('subscription error', error);
      // }
      console.error('subscription error', error);
    });
  }

  async unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    const subscription = this.activeSubscriptions[topic] ?? this.pubsub.subscription(this.getSubscriptionName(topic));
    const activeCbs = this.activeCbs[topic] ?? new Set();
    activeCbs.delete(cb);
    this.activeCbs[topic] = activeCbs;

    if (activeCbs.size === 0) {
      subscription.removeListener('message', cb);
      await subscription.close();
    }
  }

  async flush(): Promise<void> {
    await Promise.all(Object.values(this.ackBuffer));
  }
}
