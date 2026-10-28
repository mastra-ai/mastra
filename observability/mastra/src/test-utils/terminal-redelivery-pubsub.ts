import EventEmitter from 'node:events';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { Event, EventCallback } from '@mastra/core/events';

/** Replay a real terminal delivery with its original ID, and wait for the consumer's acknowledgement. */
export class TerminalRedeliveryPubSub extends EventEmitterPubSub {
  private readonly transportEmitter: EventEmitter;
  private readonly captured = new Map<string, Event>();
  private replayId?: string;
  private replayAck?: () => void;
  private readonly callbacks = new Map<EventCallback, EventCallback>();

  constructor() {
    const emitter = new EventEmitter();
    super(emitter);
    this.transportEmitter = emitter;
    for (const topic of ['workflows', 'workflows-finish']) {
      emitter.prependListener(topic, (event: Event) => {
        if (!this.captured.has(topic) && event.type === 'workflow.suspend')
          this.captured.set(topic, structuredClone(event));
      });
    }
  }

  override async subscribe(...[topic, callback, options]: Parameters<EventEmitterPubSub['subscribe']>) {
    if (!['workflows', 'workflows-finish'].includes(topic)) return super.subscribe(topic, callback, options);
    // The in-process consumer group owns its attempt counter; restore the broker
    // redelivery attempt at the subscriber boundary without changing the event ID.
    const wrapped: EventCallback = (event, ack, nack, extend) =>
      callback(
        this.replayAck && event.id === this.replayId ? { ...event, deliveryAttempt: 2 } : event,
        async () => {
          await ack?.();
          if (event.id === this.replayId) this.replayAck?.();
        },
        nack,
        extend,
      );
    this.callbacks.set(callback, wrapped);
    await super.subscribe(topic, wrapped, options);
  }

  override async unsubscribe(topic: string, callback: EventCallback) {
    await super.unsubscribe(topic, this.callbacks.get(callback) ?? callback);
    this.callbacks.delete(callback);
  }

  async replaySuspension(topic: string) {
    const captured = this.captured.get(topic);
    if (!captured) throw new Error('No workflow suspension was captured');
    await new Promise<void>(resolve => {
      this.replayAck = resolve;
      this.replayId = captured.id;
      this.transportEmitter.emit(topic, { ...structuredClone(captured), deliveryAttempt: 2 });
    });
  }
}
