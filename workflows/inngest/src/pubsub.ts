import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import type { Inngest } from 'inngest';
import { subscribe } from 'inngest/realtime';

/**
 * Build a TopicRef compatible with Inngest SDK v4's `inngest.realtime.publish()`.
 * The runtime only requires `channel` and `topic`; `config.schema` is optional and
 * we leave it absent so no validation runs.
 */
function buildTopicRef(channel: string, topic: string) {
  return { channel, topic, config: {} as any };
}

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
 * - publish() uses `inngest.realtime.publish()` (Inngest SDK v4 client API).
 *   This is non-durable: it executes immediately and is not memoized as a step.
 *   When called inside an Inngest function it auto-includes the current runId.
 * - subscribe() uses `inngest/realtime` subscribe for real-time streaming.
 *
 * Supported topic formats:
 * - "workflow.events.v2.{runId}" - workflow events
 *   -> Inngest channel: "workflow:{workflowId}:{runId}", topic: "watch"
 * - "agent.stream.{runId}" - agent stream events (for InngestAgent)
 *   -> Inngest channel: "agent:{runId}", topic: "agent-stream"
 */
export class InngestPubSub extends PubSub {
  private inngest: Inngest;
  private workflowId: string;
  private subscriptions: Map<
    string,
    {
      unsubscribe: () => void;
      callbacks: Set<(event: Event, ack?: () => Promise<void>) => void>;
    }
  > = new Map();

  constructor(inngest: Inngest, workflowId: string) {
    super();
    this.inngest = inngest;
    this.workflowId = workflowId;
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
      await this.inngest.realtime.publish(buildTopicRef(channel, inngestTopic), dataToSend);
    } catch (err: any) {
      // For agent stream terminal events, rethrow — losing a finish/error event
      // causes the client stream to hang indefinitely
      if (topicType === 'agent' && (event.type === 'finish' || event.type === 'error')) {
        throw err;
      }
      // Non-terminal events: log but don't throw
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

    // Await the subscribe call to ensure the WebSocket connection is established
    // before we consider the subscription "ready". This prevents race conditions
    // where the workflow triggers before the subscription can receive events.
    const stream = await subscribe(
      {
        channel,
        topics: [inngestTopic],
        app: this.inngest,
      },
      (message: any) => {
        // For agent stream events, message.data is the full AgentStreamEvent structure (type, runId, data)
        // For workflow events, wrap message.data in a PubSub Event format
        // IMPORTANT: Always generate a unique `id` and `createdAt` for every event.
        // CachingPubSub deduplicates events by `id` — without a unique id, all events
        // after the first would be filtered out (since undefined === undefined in the seen set).
        let event: Event;
        if (topicType === 'agent' && message.data?.type && message.data?.runId) {
          // Agent stream event - spread the AgentStreamEvent data and add required Event fields
          event = {
            id: crypto.randomUUID(),
            createdAt: new Date(),
            ...message.data,
          } as unknown as Event;
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
        try {
          void stream.cancel();
        } catch (err) {
          console.error('InngestPubSub unsubscribe error:', err);
        }
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
