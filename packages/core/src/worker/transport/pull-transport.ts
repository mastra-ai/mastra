import type { PubSub } from '../../events/pubsub';
import type { EventCallback } from '../../events/types';
import type { IMastraLogger } from '../../logger';
import type { EventRouter, WorkerTransport, WorkerTransportStopOptions } from './transport';

const TOPIC_WORKFLOWS = 'workflows';
const DEFAULT_DRAIN_TIMEOUT_MS = 5_000;

export class PullTransport implements WorkerTransport {
  #pubsub: PubSub;
  #group: string;
  #topic: string;
  #logger?: IMastraLogger;
  #drainTimeout: number;
  #callbacks: Array<{ topic: string; cb: EventCallback }> = [];
  // route() calls that have been dispatched but not yet settled. stop() waits
  // for these (bounded) so an event mid-processing is not abandoned.
  #inFlight = new Set<Promise<void>>();

  constructor({
    pubsub,
    group,
    topic,
    logger,
    drainTimeout,
  }: {
    pubsub: PubSub;
    group: string;
    /** Pubsub topic to subscribe to. Defaults to the workflows topic. */
    topic?: string;
    logger?: IMastraLogger;
    /** Max time stop() waits for in-flight route() calls, in ms. Defaults to 5000. */
    drainTimeout?: number;
  }) {
    this.#pubsub = pubsub;
    this.#group = group;
    this.#topic = topic ?? TOPIC_WORKFLOWS;
    this.#logger = logger;
    this.#drainTimeout = drainTimeout ?? DEFAULT_DRAIN_TIMEOUT_MS;
  }

  async start(router: EventRouter): Promise<void> {
    if (this.#callbacks.length > 0) {
      this.#logger?.debug('[PullTransport] start() called while already subscribed; ignoring duplicate call');
      return;
    }
    const cb: EventCallback = (event, ack, nack) => {
      // route() is async; surface unexpected rejections as a nack instead
      // of an unhandledRejection. The router's own try/catch already turns
      // expected processing errors into nack — this guard only catches
      // synchronous-throw-becomes-rejected-promise leaks.
      const inFlight = router.route(event, ack, nack).catch(err => {
        try {
          // Best-effort: ack/nack are optional in some PubSub backends.
          if (typeof nack === 'function') {
            void nack();
          }
        } finally {
          this.#logger?.error('[PullTransport] router.route rejected', { err });
        }
      });
      this.#inFlight.add(inFlight);
      void inFlight.finally(() => this.#inFlight.delete(inFlight));
    };
    await this.#pubsub.subscribe(this.#topic, cb, { group: this.#group });
    this.#callbacks.push({ topic: this.#topic, cb });
  }

  async stop(options?: WorkerTransportStopOptions): Promise<void> {
    // Unsubscribe first so no new events land while we drain; events already
    // handed to the router keep running and may still publish/ack/nack.
    for (const { topic, cb } of this.#callbacks) {
      await this.#pubsub.unsubscribe(topic, cb);
    }
    this.#callbacks = [];
    await this.#drainInFlight(options?.drainTimeout ?? this.#drainTimeout);
    await this.#pubsub.flush();
  }

  async #drainInFlight(drainTimeout: number): Promise<void> {
    if (this.#inFlight.size === 0) return;
    const pending = this.#inFlight.size;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = await Promise.race([
        Promise.allSettled([...this.#inFlight]).then(() => false),
        new Promise<boolean>(resolve => {
          timeoutHandle = setTimeout(() => resolve(true), drainTimeout);
        }),
      ]);
      if (timedOut) {
        this.#logger?.warn(
          `[PullTransport] stop() timed out after ${drainTimeout}ms waiting for ${pending} in-flight event(s)`,
        );
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}
