import { PubSub as PubSubClient } from '@google-cloud/pubsub';
import type { ClientConfig } from '@google-cloud/pubsub';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';

export class GoogleCloudPubSub extends PubSub {
  private pubsub: PubSubClient;
  private ackBuffer: Record<string, Promise<any>> = {};

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
        enableExactlyOnceDelivery: topicName === 'workflows' ? true : false,
      });
      console.log('subscription created', sub);
    } catch (error) {
      console.log('subscription already exists?', error);
    }
  }

  async destroy(topicName: string) {
    await this.pubsub.subscription(topicName).delete();
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

  async subscribe(topic: string, cb: (event: Event, ack: () => Promise<void>) => void): Promise<void> {
    let runId: string | undefined = undefined;
    if (topic.startsWith('workflow.events.')) {
      const parts = topic.split('.');
      if (parts[parts.length - 2] === 'v2') {
        topic = 'workflow.events.v2';
      } else {
        topic = 'workflow.events.v1';
      }

      runId = parts[parts.length - 1];
    }

    let subscription = this.pubsub.subscription(topic);
    subscription.on('message', message => {
      const event = JSON.parse(message.data.toString()) as Event;
      console.log('message received', event, cb);
      try {
        cb(event, async () => {
          if (runId) {
            if (runId !== event.data.runId) {
              return;
            }
          }

          console.log('acking message');
          try {
            const ackResponse = Promise.race([
              message.ackWithResponse(),
              new Promise(resolve => setTimeout(resolve, 5000)),
            ]);
            this.ackBuffer[topic + '-' + message.id] = ackResponse.catch(() => {});
            await ackResponse;
            delete this.ackBuffer[topic + '-' + message.id];
            console.log('message acked', ackResponse);
          } catch (e) {
            console.error('Error acking message', e);
          }
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
        console.log('subscription resubscribed');
      } else {
        // TODO: determine if other errors require re-subscription
        // console.error('subscription error, retrying in 5 seconds', error);
        // await new Promise(resolve => setTimeout(resolve, 5000));
        // await this.subscribe(topic, cb);
        console.error('subscription error', error);
      }
    });
  }

  async unsubscribe(topic: string, cb: (event: Event, ack: () => Promise<void>) => void): Promise<void> {
    const subscription = this.pubsub.subscription(topic);
    subscription.removeListener('message', cb);
    await subscription.close();
  }

  async flush(): Promise<void> {
    console.log('flushing_ack', this.ackBuffer);
    await Promise.all(Object.values(this.ackBuffer));
  }
}
