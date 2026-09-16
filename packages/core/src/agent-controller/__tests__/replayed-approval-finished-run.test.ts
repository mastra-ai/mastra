import { describe, expect, it } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { AGENT_THREAD_KEY_SEPARATOR, LeasePubSub } from '../../agent/__tests__/thread-stream-test-utils';
import type { Event, EventCallback } from '../../events';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const TOOL_NAME = 'factory_transition_work_item';
const resourceId = 'code-session';
const threadId = 'thread-1';
const threadKey = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
const threadTopic = `agent.thread-stream.${encodeURIComponent(threadKey)}`;

/** Redis Streams hands every retained event to a new subscriber; LeasePubSub alone only forwards live ones. */
class RetainingLeasePubSub extends LeasePubSub {
  #retained = new Map<string, Omit<Event, 'id' | 'createdAt'>[]>();

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    this.#retained.set(topic, [...(this.#retained.get(topic) ?? []), event]);
    await super.publish(topic, event);
  }

  override async subscribe(topic: string, cb: EventCallback): Promise<void> {
    await super.subscribe(topic, cb);
    for (const event of this.#retained.get(topic) ?? []) {
      await cb({ ...event, id: 'evt', createdAt: new Date() }, async () => {});
    }
  }
}

async function publishFinishedApprovalRunFromAnotherInstance(pubsub: RetainingLeasePubSub) {
  const runId = 'triage-run';
  const streamId = 'triage-stream';
  const publish = (data: Record<string, unknown>) =>
    pubsub.publish(threadTopic, { type: 'agent.thread-stream', runId, data });

  await pubsub.acquireLease(threadKey, runId);
  await publish({ type: 'run-registered', runId, streamId, streamSeq: 1, sourceId: 'instance-a' });
  await publish({
    type: 'stream-part',
    runId,
    streamId,
    sourceId: 'instance-a',
    part: {
      type: 'tool-call-approval',
      payload: { toolCallId: 'call-1', toolName: TOOL_NAME, args: { stage: 'Planning' } },
    },
  });
  await publish({
    type: 'stream-part',
    runId,
    streamId,
    sourceId: 'instance-a',
    part: { type: 'finish', payload: { stepResult: { reason: 'stop' } } },
  });
  await publish({ type: 'run-completed', runId, streamId, persisted: true });
  await pubsub.releaseLease(threadKey, runId);
}

async function createSessionOn(pubsub: LeasePubSub) {
  const transition = createTool({
    id: TOOL_NAME,
    description: 'Request a governed stage transition.',
    inputSchema: z.object({ stage: z.string() }),
    requireApproval: true,
    execute: async () => ({ status: 'accepted' }),
  });
  const agent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: 'Triage the work item.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: new ReadableStream({ start: controller => controller.close() }) }),
    }),
    tools: { [TOOL_NAME]: transition },
    pubsub,
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'code-agent': agent }, logger: false, storage });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'code-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent('code-agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'code-session', ownerId: 'owner-1', resourceId });
  const events: AgentControllerEvent[] = [];
  session.subscribe((event: AgentControllerEvent) => events.push(event));
  return { session, events };
}

async function waitFor(predicate: () => boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

const eventTypes = (events: AgentControllerEvent[]) => events.map(event => event.type);

describe('run engine: replayed tool-call-approval of a run that already finished', () => {
  it('auto-approved tool: consumes the replay without failing the session', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFinishedApprovalRunFromAnotherInstance(pubsub);
    const { session, events } = await createSessionOn(pubsub);
    await session.permissions.setForTool({ toolName: TOOL_NAME, policy: 'allow' });

    await session.thread.create({ id: threadId });

    expect(await waitFor(() => eventTypes(events).includes('agent_end'))).toBe(true);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it('tool awaiting a human decision: does not ask for one on the finished run', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFinishedApprovalRunFromAnotherInstance(pubsub);
    const { session, events } = await createSessionOn(pubsub);

    await session.thread.create({ id: threadId });

    expect(await waitFor(() => eventTypes(events).includes('agent_end'))).toBe(true);
    expect(eventTypes(events)).not.toContain('tool_approval_required');
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });
});
