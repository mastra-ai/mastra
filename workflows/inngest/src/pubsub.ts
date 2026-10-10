import { PubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import type { IMastraLogger } from '@mastra/core/logger';
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
 * - "agent.control.{runId}" - agent control events (cross-process abort)
 *
 * @returns { runId, topicType } or null if not a recognized format
 */
function parseTopic(topic: string): { runId: string; topicType: 'workflow' | 'agent-stream' | 'agent-control' } | null {
  // Try workflow format first
  const workflowMatch = topic.match(/^workflow\.events\.v2\.(.+)$/);
  if (workflowMatch && workflowMatch[1]) {
    return { runId: workflowMatch[1], topicType: 'workflow' };
  }

  // Try agent stream format
  const agentStreamMatch = topic.match(/^agent\.stream\.(.+)$/);
  if (agentStreamMatch && agentStreamMatch[1]) {
    return { runId: agentStreamMatch[1], topicType: 'agent-stream' };
  }

  // Try agent control format
  const agentControlMatch = topic.match(/^agent\.control\.(.+)$/);
  if (agentControlMatch && agentControlMatch[1]) {
    return { runId: agentControlMatch[1], topicType: 'agent-control' };
  }

  return null;
}

/**
 * Warn once per unrecognized topic family so a missing topic mapping never fails
 * silently again (dropped `agent.control.*` aborts shipped invisibly — see #22543).
 * Deduped on the topic's leading two segments so run-scoped topics neither spam
 * the logs nor grow the set unboundedly.
 */
const warnedUnrecognizedTopics = new Set<string>();
function warnUnrecognizedTopic(topic: string): void {
  const family = topic.split('.').slice(0, 2).join('.');
  if (warnedUnrecognizedTopics.has(family)) return;
  warnedUnrecognizedTopics.add(family);
  console.warn(`InngestPubSub: ignoring unrecognized topic format "${topic}"`);
}

/**
 * Inngest Realtime delivers messages over ~512 KB truncated, as an unparseable
 * string (#20671). Stay safely under that cap.
 */
const REALTIME_MAX_BYTES = 480 * 1024;
const TERMINAL_AGENT_EVENTS = new Set(['finish', 'error', 'abort']);

/** Chunk type streamed in place of an agent event that exceeded the Realtime cap. */
export const OVERSIZED_EVENT_CHUNK_TYPE = 'data-oversized-event';

function oversizedPlaceholder(
  runId: string,
  eventType: string,
  chunkType: string | undefined,
  bytes: number | undefined,
) {
  return {
    type: 'chunk',
    runId,
    data: {
      type: OVERSIZED_EVENT_CHUNK_TYPE,
      transient: true,
      data: { eventType, chunkType, bytes, limit: REALTIME_MAX_BYTES },
    },
  };
}

function byteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Reduce an agent event that would exceed the Realtime cap. `finish` keeps the
 * fields stream consumers read (text, usage, stepResult) and drops the
 * per-step record; other oversized events are replaced by a small
 * `data-oversized-event` chunk rather than delivered truncated.
 */
function fitAgentEvent(event: Omit<Event, 'id' | 'createdAt'>): Omit<Event, 'id' | 'createdAt'> {
  const bytes = byteSize(event);
  if (bytes <= REALTIME_MAX_BYTES) return event;
  if (event.type !== 'finish') {
    if (TERMINAL_AGENT_EVENTS.has(event.type)) return { type: event.type, runId: event.runId, data: {} };
    return oversizedPlaceholder(event.runId, event.type, (event.data as { type?: string } | undefined)?.type, bytes);
  }
  const data = (event.data ?? {}) as { output?: Record<string, unknown>; stepResult?: unknown };
  const output = data.output ?? {};
  const reduced = {
    ...event,
    data: {
      stepResult: data.stepResult,
      output: { text: output.text, usage: output.usage, steps: [] },
    },
  };
  if (byteSize(reduced) <= REALTIME_MAX_BYTES) return reduced;
  const reason = (data.stepResult as { reason?: unknown } | undefined)?.reason;
  // Last resort: the bare terminal envelope always fits, so the stream still closes.
  return {
    ...event,
    data: { stepResult: typeof reason === 'string' ? { reason } : undefined, output: { steps: [] } },
  };
}

/**
 * Recover an agent event Realtime truncated into a raw string. Terminal events are
 * salvaged into a minimal envelope so attached streams close; anything else becomes
 * a `data-oversized-event` placeholder chunk.
 */
function salvageTruncatedAgentEvent(raw: string, runId: string): { type: string; runId: string; data: unknown } {
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type && parsed?.runId) return parsed;
  } catch {
    // truncated
  }
  const type = raw.slice(0, 256).match(/"type"\s*:\s*"([^"]+)"/)?.[1];
  if (!type || !TERMINAL_AGENT_EVENTS.has(type)) {
    const chunkType = raw.match(/"data"\s*:\s*\{\s*"type"\s*:\s*"([^"]+)"/)?.[1];
    return oversizedPlaceholder(runId, type ?? 'unknown', chunkType, undefined);
  }
  const reason = raw.match(/"stepResult"\s*:\s*\{[^{}]*"reason"\s*:\s*"([^"]+)"/)?.[1];
  return {
    type,
    runId,
    data: type === 'finish' ? { output: { steps: [] }, stepResult: reason ? { reason } : undefined } : {},
  };
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
 * - "agent.control.{runId}" - agent control events (cross-process abort)
 *   -> Inngest channel: "agent:{runId}", topic: "agent-control"
 */
export class InngestPubSub extends PubSub {
  private inngest: Inngest;
  private workflowId: string;
  private logger?: IMastraLogger;
  private subscriptions: Map<
    string,
    {
      unsubscribe: () => void;
      callbacks: Set<(event: Event, ack?: () => Promise<void>) => void>;
    }
  > = new Map();

  constructor(inngest: Inngest, workflowId: string, logger?: IMastraLogger) {
    super();
    this.inngest = inngest;
    this.workflowId = workflowId;
    this.logger = logger;
  }

  async publishWorkflowWatchTo(workflowId: string, runId: string, data: unknown): Promise<void> {
    await this.inngest.realtime.publish(buildTopicRef(`workflow:${workflowId}:${runId}`, 'watch'), data);
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
   * - "agent.control.{runId}" - agent control events (cross-process abort)
   *   -> channel: "agent:{runId}", topic: "agent-control"
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const parsed = parseTopic(topic);
    if (!parsed) {
      warnUnrecognizedTopic(topic);
      return; // Ignore unrecognized topic formats
    }

    const { runId, topicType } = parsed;

    // Agent stream/control events share the runId-only channel (so nested workflows
    // publish to the same channel) but use separate Inngest topics so control
    // traffic never reaches stream consumers.
    const isAgentTopic = topicType === 'agent-stream' || topicType === 'agent-control';
    const inngestTopic = isAgentTopic ? topicType : 'watch';
    const channel = isAgentTopic ? `agent:${runId}` : `workflow:${this.workflowId}:${runId}`;

    try {
      // For agent stream/control events, send the full event structure so subscribers can access type/runId/data
      // For workflow events, send just the data (existing behavior)
      let dataToSend: unknown = event.data;
      if (isAgentTopic) {
        const fitted = fitAgentEvent(event);
        if (fitted !== event) {
          const message = `InngestPubSub: "${event.type}" event for run ${runId} exceeds the Inngest Realtime size limit (${REALTIME_MAX_BYTES} bytes); sending a reduced event instead`;
          if (this.logger) this.logger.warn(message);
          else console.warn(message);
        }
        dataToSend = fitted;
      }
      await this.inngest.realtime.publish(buildTopicRef(channel, inngestTopic), dataToSend);
    } catch (err: any) {
      // Rethrow when losing the event would break the caller:
      // - agent control events: a dropped abort-request means a remote run cannot be
      //   stopped; core's requestRemoteAbort() catches and logs with agentId/runId context
      // - agent stream terminal events: losing a finish/error event causes the client
      //   stream to hang indefinitely
      if (
        topicType === 'agent-control' ||
        (topicType === 'agent-stream' && (event.type === 'finish' || event.type === 'error'))
      ) {
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
   * - "agent.control.{runId}" - agent control events (cross-process abort)
   *   -> channel: "agent:{runId}", topic: "agent-control"
   */
  async subscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void> {
    const parsed = parseTopic(topic);
    if (!parsed) {
      warnUnrecognizedTopic(topic);
      return; // Ignore unrecognized topic formats
    }

    const { runId, topicType } = parsed;

    // Check if we already have a subscription for this topic
    if (this.subscriptions.has(topic)) {
      this.subscriptions.get(topic)!.callbacks.add(cb);
      return;
    }

    const callbacks = new Set<(event: Event, ack?: () => Promise<void>) => void>([cb]);

    // Agent stream/control events share the runId-only channel (so nested workflows
    // publish to the same channel) but use separate Inngest topics so control
    // traffic never reaches stream consumers.
    const isAgentTopic = topicType === 'agent-stream' || topicType === 'agent-control';
    const inngestTopic = isAgentTopic ? topicType : 'watch';
    const channel = isAgentTopic ? `agent:${runId}` : `workflow:${this.workflowId}:${runId}`;

    // Await the subscribe call to ensure the WebSocket connection is established
    // before we consider the subscription "ready". This prevents race conditions
    // where the workflow triggers before the subscription can receive events.
    const subscription = await subscribe({
      channel,
      topics: [inngestTopic],
      app: this.inngest,
      onMessage: (message: any) => {
        // For agent stream/control events, message.data is the full event structure (type, runId, data)
        // For workflow events, wrap message.data in a PubSub Event format
        // IMPORTANT: Always generate a unique `id` and `createdAt` for every event.
        // CachingPubSub deduplicates events by `id` — without a unique id, all events
        // after the first would be filtered out (since undefined === undefined in the seen set).
        let event: Event;
        if (isAgentTopic && typeof message.data === 'string') {
          const salvaged = salvageTruncatedAgentEvent(message.data, runId);
          event = { id: crypto.randomUUID(), createdAt: new Date(), ...salvaged } as unknown as Event;
        } else if (isAgentTopic && message.data?.type && message.data?.runId) {
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
    });

    this.subscriptions.set(topic, {
      unsubscribe: () => {
        try {
          void subscription.close();
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
