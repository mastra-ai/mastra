import { PubSub as PubSubClient } from '@google-cloud/pubsub';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';

export class GoogleCloudPubSub extends PubSub {
  private pubsub: PubSubClient;

  constructor() {
    super();
    this.pubsub = new PubSubClient();
  }

  async init() {
    await this.pubsub.topic('workflows').createSubscription('workflows-subscription', {
      enableMessageOrdering: true,
      enableExactlyOnceDelivery: true,
    });
  }

  async publish(topicName: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const topic = this.pubsub.topic(topicName);
    const messageId = await topic.publishMessage({ data: Buffer.from(JSON.stringify(event)) });
    console.log('message sent', topicName, event, messageId);
  }

  async subscribe(topic: string, cb: (event: Event) => void): Promise<void> {
    const subscription = this.pubsub.subscription('workflows-subscription');
    subscription.on('message', message => {
      const event = JSON.parse(message.data.toString()) as Event;
      cb(event, async () => {
        message.ack();
      });
    });
  }

  async unsubscribe(topic: string, cb: (event: Event) => void): Promise<void> {
    const subscription = this.pubsub.subscription('workflows-subscription');
    subscription.removeListener('message', cb);
  }
}
