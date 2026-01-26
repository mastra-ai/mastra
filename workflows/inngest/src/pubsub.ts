import { subscribe } from '@inngest/realtime';
import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import type { Inngest } from 'inngest';

/**
 * Type for Inngest's publish function, available inside Inngest function context.
 */
export type InngestPublishFn = (opts: { channel: string; topic: string; data: any }) => Promise<void>;

/**
 * Parse a topic string and extract the runId and topic type.
 *
 * Supported formats:
 * - "workflow.events.v2.{runId}" - workflow events
 * - "agent.stream.{runId}" - agent stream events
 *
 * @returns { runId, topicType } or null if not a recognized format
 */
function parseTopic(topic: string): { runId: string; topicType: 'workflow' | 'agent' } | null {
  // Try workflow format first
  const workflowMatch = topic.match(/^workflow\.events\.v2\.(.+)$/);
  if (workflowMatch && workflowMatch[1]) {
    return { runId: workflowMatch[1], topicType: 'workflow' };
  }

  // Try agent stream format
  const agentMatch = topic.match(/^agent\.stream\.(.+)$/);
  if (agentMatch && agentMatch[1]) {
    return { runId: agentMatch[1], topicType: 'agent' };
  }

  return null;
}

/**
 * PubSub implementation for Inngest workflows.
 *
 * This bridges the PubSub abstract class interface with Inngest's realtime system:
 * - publish() uses Inngest's publish function (only available in function context)
 * - subscribe() uses @inngest/realtime subscribe for real-time streaming
 *
 * Supported topic formats:
 * - "workflow.events.v2.{runId}" - workflow events
 * - "agent.stream.{runId}" - agent stream events (for InngestDurableAgent)
 *
 * Both map to Inngest channel: "workflow:{workflowId}:{runId}"
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
   * Supported topic formats:
   * - "workflow.events.v2.{runId}" - workflow events
   *   -> channel: "workflow:{workflowId}:{runId}", topic: "watch"
   * - "agent.stream.{runId}" - agent stream events
   *   -> channel: "agent:{runId}", topic: "agent-stream"
   *   (Note: agent stream uses runId-only channel so nested workflows can publish to same channel)
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (!this.publishFn) {
      // Silently ignore if no publish function (e.g., outside Inngest context)
      return;
    }

    const parsed = parseTopic(topic);
    if (!parsed) {
      return; // Ignore unrecognized topic formats
    }

    const { runId, topicType } = parsed;

    // Use different Inngest topics and channels for different event types
    // Agent stream events use a runId-only channel so nested workflows publish to the same channel
    const inngestTopic = topicType === 'agent' ? 'agent-stream' : 'watch';
    const channel = topicType === 'agent' ? `agent:${runId}` : `workflow:${this.workflowId}:${runId}`;

    try {
      // For agent stream events, send the full event structure so subscribers can access type/runId/data
      // For workflow events, send just the data (existing behavior)
      const dataToSend = topicType === 'agent' ? event : event.data;
      await this.publishFn({
        channel,
        topic: inngestTopic,
        data: dataToSend,
      });
    } catch (err: any) {
      // Log but don't throw - publishing failures shouldn't break workflow execution
      console.error('InngestPubSub publish error:', err?.message ?? err);
    }
  }

  /**
   * Subscribe to events from Inngest's realtime system.
   *
   * Supported topic formats:
   * - "workflow.events.v2.{runId}" - workflow events
   *   -> channel: "workflow:{workflowId}:{runId}", topic: "watch"
   * - "agent.stream.{runId}" - agent stream events
   *   -> channel: "agent:{runId}", topic: "agent-stream"
   *   (Note: agent stream uses runId-only channel so nested workflows can publish to same channel)
   */
  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    const parsed = parseTopic(topic);
    if (!parsed) {
      return; // Ignore unrecognized topic formats
    }

    const { runId, topicType } = parsed;

    // Check if we already have a subscription for this topic
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)!.callbacks.add(cb);
      return;
    }

    const callbacks = new Set<(event: Event, ack?: () => Promise<void>) => void>([cb]);

    // Use different Inngest topics and channels for different event types
    // Agent stream events use a runId-only channel so nested workflows publish to the same channel
    const inngestTopic = topicType === 'agent' ? 'agent-stream' : 'watch';
    const channel = topicType === 'agent' ? `agent:${runId}` : `workflow:${this.workflowId}:${runId}`;

    const streamPromise = subscribe(
      {
        channel,
        topics: [inngestTopic],
        app: this.inngest,
      },
      (message: any) => {
        // For agent stream events, message.data is the full AgentStreamEvent structure (type, runId, data)
        // For workflow events, wrap message.data in a PubSub Event format
        let event: Event;
        if (topicType === 'agent' && message.data?.type && message.data?.runId) {
          // Agent stream event - pass through the structure as-is (it's already an AgentStreamEvent)
          event = message.data as unknown as Event;
        } else {
          // Workflow event or fallback - wrap in standard Event format
          event = {
            id: crypto.randomUUID(),
            type: inngestTopic,
            runId,
            data: message.data,
            createdAt: new Date(),
          };
        }

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
