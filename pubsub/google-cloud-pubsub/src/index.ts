import { PubSub as PubSubClient } from '@google-cloud/pubsub';
import type { ClientConfig } from '@google-cloud/pubsub';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';

export class GoogleCloudPubSub extends PubSub {
  private pubsub: PubSubClient;

  constructor(config: ClientConfig) {
    super();
    this.pubsub = new PubSubClient(config);
  }

  async init(topicName: string) {
    try {
      const topic = await this.pubsub.createTopic(topicName);
      console.log('topic created', topic);
    } catch (error) {
      console.log('topic already exists?', error);
    }
    try {
      const sub = await this.pubsub.topic(topicName).createSubscription(topicName, {
        enableMessageOrdering: true,
        enableExactlyOnceDelivery: true,
      });
      console.log('subscription created', sub);
    } catch (error) {
      console.log('subscription already exists?', error);
    }
  }

  async publish(topicName: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    let topic = this.pubsub.topic(topicName);

    console.log('publishing message', topicName, event);
    try {
      const messageId = await topic.publishMessage({
        data: Buffer.from(JSON.stringify(event)),
        orderingKey: 'workflows',
      });
      console.log('message sent', topicName, event, messageId);
    } catch (e: any) {
      if (e.code === 5) {
        console.log('topic does not exist, creating it', topicName);
        await this.pubsub.createTopic(topicName);
        await this.publish(topicName, event);
      } else {
        throw e;
      }
    }
  }

  async subscribe(topic: string, cb: (event: Event, ack: () => void) => void): Promise<void> {
    let subscription = this.pubsub.subscription(topic);
    subscription.on('message', message => {
      const event = JSON.parse(message.data.toString()) as Event;
      console.log('message received', event, cb);
      try {
        cb(event, () => {
          message.ack();
        });
      } catch (error) {
        console.error('Error processing event', error);
      }
    });

    subscription.on('error', async error => {
      if (error.code === 5) {
        subscription.removeListener('message', cb);
        console.log('subscription not found, creating it');
        await this.init(topic);
        console.log('subscription created, resubscribing');
        await this.subscribe(topic, cb);
      } else {
        // TODO: determine if other errors require re-subscription
        // console.error('subscription error, retrying in 5 seconds', error);
        // await new Promise(resolve => setTimeout(resolve, 5000));
        // await this.subscribe(topic, cb);
        console.error('subscription error', error);
      }
    });
  }

  async unsubscribe(topic: string, cb: (event: Event, ack: () => void) => void): Promise<void> {
    const subscription = this.pubsub.subscription(topic);
    subscription.removeListener('message', cb);
  }
}
