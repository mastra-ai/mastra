import type { PubSub } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import type { EventRouter, WorkerTransport } from './transport';

const TOPIC_WORKFLOWS = 'workflows';

export class PullTransport implements WorkerTransport {
  #pubsub: PubSub;
  #group: string;
  #callbacks: Array<{ topic: string; cb: EventCallback }> = [];

  constructor({ pubsub, group }: { pubsub: PubSub; group: string }) {
    this.#pubsub = pubsub;
    this.#group = group;
  }

  async start(router: EventRouter): Promise<void> {
    const workflowCb: EventCallback = (event, ack, nack) => {
      // route() is async; surface unexpected rejections as a nack instead
      // of an unhandledRejection. The router's own try/catch already turns
      // expected processing errors into nack — this guard only catches
      // synchronous-throw-becomes-rejected-promise leaks.
      router.route(event, ack, nack).catch(err => {
        try {
          // Best-effort: ack/nack are optional in some PubSub backends.
          if (typeof nack === 'function') {
            void nack();
          }
        } finally {
          console.error('[PullTransport] router.route rejected:', err);
        }
      });
    };
    await this.#pubsub.subscribe(TOPIC_WORKFLOWS, workflowCb, { group: this.#group });
    this.#callbacks.push({ topic: TOPIC_WORKFLOWS, cb: workflowCb });
  }

  async stop(): Promise<void> {
    for (const { topic, cb } of this.#callbacks) {
      await this.#pubsub.unsubscribe(topic, cb);
    }
    this.#callbacks = [];
    await this.#pubsub.flush();
  }
}
