import { AsyncLocalStorage } from 'node:async_hooks';
import type { Event } from '@mastra/core/events';
import { z } from 'zod/v4';

const deferredEventSchema = z.object({
  topic: z.string(),
  event: z
    .object({
      type: z.string(),
      runId: z.string(),
      data: z.unknown(),
    })
    .passthrough(),
  options: z.object({ localOnly: z.boolean().optional() }).optional(),
});

export const agentLifecycleEventsSchema = z.array(deferredEventSchema);
export type DeferredAgentEvent = z.infer<typeof deferredEventSchema>;

const operationEnvelopeSchema = z.object({
  __mastraInngestOperation: z.literal('agent-lifecycle-v1'),
  value: z.unknown(),
  events: agentLifecycleEventsSchema,
});

export const agentEventBuffer = new AsyncLocalStorage<{ runId: string; events: DeferredAgentEvent[] }>();

/** Hold only lifecycle events for this execution; tokens and other agents stay live. */
export function deferAgentLifecycleEvent(
  topic: string,
  event: Omit<Event, 'id' | 'createdAt'>,
  options?: { localOnly?: boolean },
): boolean {
  const buffer = agentEventBuffer.getStore();
  if (!buffer || event.runId !== buffer.runId || topic !== `agent.stream.${buffer.runId}`) return false;
  const chunkType: unknown = event.data?.type;
  if (
    event.type !== 'finish' &&
    event.type !== 'suspended' &&
    !(event.type === 'chunk' && (chunkType === 'tool-call-approval' || chunkType === 'tool-call-suspended'))
  )
    return false;
  buffer.events.push({ topic, event, options });
  return true;
}

export function wrapAgentOperation(value: unknown, events: DeferredAgentEvent[]): unknown {
  return events.length ? { __mastraInngestOperation: 'agent-lifecycle-v1', value, events } : value;
}

/** Old memoized operations have no envelope and remain readable after an upgrade. */
export function unwrapAgentOperation(value: unknown, events: DeferredAgentEvent[]): unknown {
  const parsed = operationEnvelopeSchema.safeParse(value);
  if (!parsed.success) return value;
  events.push(...parsed.data.events);
  return parsed.data.value;
}
