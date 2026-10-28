import { EventEmitterPubSub } from '@mastra/core/events';
import type { EventCallback } from '@mastra/core/events';

/** Hold a real child start after publication begins, then wait for its consumer acknowledgement. */
export class DelayedNestedStartPubSub extends EventEmitterPubSub {
  private releaseStart!: () => void;
  private readonly gate = new Promise<void>(resolve => {
    this.releaseStart = resolve;
  });
  private acknowledge!: () => void;
  private readonly acknowledged = new Promise<void>(resolve => {
    this.acknowledge = resolve;
  });
  private readonly callbacks = new Map<EventCallback, EventCallback>();
  child?: { workflowId: string; runId: string };

  override async publish(...[topic, event, options]: Parameters<EventEmitterPubSub['publish']>) {
    if (topic === 'workflows' && event.type === 'workflow.start' && event.data?.parentWorkflow) {
      this.child = { workflowId: event.data.workflowId, runId: event.data.runId };
      await this.gate;
    }
    return super.publish(topic, event, options);
  }

  override async subscribe(...[topic, callback, options]: Parameters<EventEmitterPubSub['subscribe']>) {
    const wrapped: EventCallback = (event, ack, nack, extend) =>
      callback(
        event,
        async () => {
          await ack?.();
          if (event.type === 'workflow.start' && event.data?.runId === this.child?.runId) this.acknowledge();
        },
        nack,
        extend,
      );
    this.callbacks.set(callback, wrapped);
    return super.subscribe(topic, wrapped, options);
  }

  override async unsubscribe(topic: string, callback: EventCallback) {
    await super.unsubscribe(topic, this.callbacks.get(callback) ?? callback);
    this.callbacks.delete(callback);
  }

  release() {
    this.releaseStart();
  }
  async deliver() {
    this.releaseStart();
    await this.acknowledged;
  }
}
