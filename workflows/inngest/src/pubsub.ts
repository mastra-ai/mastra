import { subscribe } from '@inngest/realtime';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import type { Inngest } from 'inngest';

// Diagnostic logging helper - enable with DEBUG_INNGEST=1
const DIAG = (area: string, msg: string, data?: any) => {
  if (!process.env.DEBUG_INNGEST) return;
  const ts = new Date().toISOString().slice(11, 23);
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.info(`[DIAG:pubsub:${area}] ${ts} ${msg}${dataStr}`);
};

/**
 * Type for Inngest's publish function, available inside Inngest function context.
 */
export type InngestPublishFn = (opts: { channel: string; topic: string; data: any }) => Promise<void>;

/**
 * PubSub implementation for Inngest workflows.
 *
 * This bridges the PubSub abstract class interface with Inngest's realtime system:
 * - publish() uses Inngest's publish function (only available in function context)
 * - subscribe() uses @inngest/realtime subscribe for real-time streaming
 *
 * Topic format: "workflow.events.v2.{runId}"
 * Channel format: "workflow:{workflowId}:{runId}"
 */
export class InngestPubSub extends PubSub {
  private inngest: Inngest;
  private workflowId: string;
  private publishFn?: InngestPublishFn;
  private subscriptions: Map<
    string,
    {
      unsubscribe: () => void;
      callbacks: Set<(event: Event, ack?: () => Promise<void>) => void>;
    }
  > = new Map();

  constructor(inngest: Inngest, workflowId: string, publishFn?: InngestPublishFn) {
    super();
    this.inngest = inngest;
    this.workflowId = workflowId;
    this.publishFn = publishFn;
  }

  /**
   * Publish an event to Inngest's realtime system.
   *
   * Topic format: "workflow.events.v2.{runId}"
   * Maps to Inngest channel: "workflow:{workflowId}:{runId}"
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (!this.publishFn) {
      // Silently ignore if no publish function (e.g., outside Inngest context)
      return;
    }

    // Parse topic to extract runId
    // Topic format: "workflow.events.v2.{runId}"
    const match = topic.match(/^workflow\.events\.v2\.(.+)$/);
    if (!match) {
      return; // Ignore non-workflow topics
    }

    const runId = match[1];
    const eventType = (event.data as any)?.type;
    DIAG('publish', `Publishing event`, {
      workflowId: this.workflowId,
      runId,
      eventType,
      channel: `workflow:${this.workflowId}:${runId}`,
    });

    try {
      const publishStart = Date.now();
      await this.publishFn({
        channel: `workflow:${this.workflowId}:${runId}`,
        topic: 'watch',
        data: event.data,
      });
      DIAG('publish', `Event published`, {
        workflowId: this.workflowId,
        runId,
        eventType,
        durationMs: Date.now() - publishStart,
      });
    } catch (err: any) {
      // Log but don't throw - publishing failures shouldn't break workflow execution
      DIAG('publish', `ERROR publishing event`, {
        workflowId: this.workflowId,
        runId,
        eventType,
        error: err?.message ?? err,
      });
      console.error('InngestPubSub publish error:', err?.message ?? err);
    }
  }

  /**
   * Subscribe to events from Inngest's realtime system.
   *
   * Topic format: "workflow.events.v2.{runId}"
   * Maps to Inngest channel: "workflow:{workflowId}:{runId}"
   */
  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    // Parse topic: "workflow.events.v2.{runId}"
    const match = topic.match(/^workflow\.events\.v2\.(.+)$/);
    if (!match || !match[1]) {
      return; // Ignore non-workflow topics
    }

    const runId: string = match[1];

    // Check if we already have a subscription for this topic
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)!.callbacks.add(cb);
      return;
    }

    const callbacks = new Set<(event: Event, ack?: () => Promise<void>) => void>([cb]);

    const channel = `workflow:${this.workflowId}:${runId}`;

    const streamPromise = subscribe(
      {
        channel,
        topics: ['watch'],
        app: this.inngest,
      },
      (message: any) => {
        // Transform Inngest message to PubSub Event format
        const event: Event = {
          id: crypto.randomUUID(),
          type: 'watch',
          runId,
          data: message.data,
          createdAt: new Date(),
        };

        for (const callback of callbacks) {
          callback(event);
        }
      },
    );

    this.subscriptions.set(topic, {
      unsubscribe: () => {
        streamPromise
          .then(stream => stream.cancel())
          .catch(err => {
            console.error('InngestPubSub unsubscribe error:', err);
          });
      },
      callbacks,
    });
  }

  /**
   * Unsubscribe a callback from a topic.
   * If no callbacks remain, the underlying Inngest subscription is cancelled.
   */
  async unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    const sub = this.subscriptions.get(topic);
    if (!sub) {
      return;
    }

    sub.callbacks.delete(cb);

    // If no more callbacks, cancel the subscription
    if (sub.callbacks.size === 0) {
      sub.unsubscribe();
      this.subscriptions.delete(topic);
    }
  }

  /**
   * Flush any pending operations. No-op for Inngest.
   */
  async flush(): Promise<void> {
    // No-op for Inngest
  }

  /**
   * Clean up all subscriptions during graceful shutdown.
   */
  async close(): Promise<void> {
    for (const [, sub] of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
  }
}
