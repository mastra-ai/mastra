import { afterEach, describe, expect, it } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { AGENT_THREAD_KEY_SEPARATOR, LeasePubSub } from '../../agent/__tests__/thread-stream-test-utils';
import type { Event, EventCallback } from '../../events';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { DelayedPromise } from '../../stream/aisdk/v5/compat/delayed-promise';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const TOOL_NAME = 'factory_transition_work_item';
const resourceId = 'code-session';
const threadId = 'thread-1';
const runId = 'triage-run';
const threadKey = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
const threadTopic = `agent.thread-stream.${encodeURIComponent(threadKey)}`;
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

class RetainingLeasePubSub extends LeasePubSub {
  #retained = new Map<string, Omit<Event, 'id' | 'createdAt'>[]>();

  fork(): RetainingLeasePubSub {
    const subscriber = new RetainingLeasePubSub();
    subscriber.#retained = this.#retained;
    subscriber.owners = this.owners;
    return subscriber;
  }

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const retained = this.#retained.get(topic) ?? [];
    retained.push(event);
    this.#retained.set(topic, retained);
    await super.publish(topic, event);
  }

  override async subscribe(topic: string, callback: EventCallback): Promise<void> {
    await super.subscribe(topic, callback);
    for (const event of this.#retained.get(topic) ?? []) {
      await callback({ ...event, id: 'evt', createdAt: new Date() }, async () => {});
    }
  }
}

class PausedBroadcastPubSub extends RetainingLeasePubSub {
  readonly startedPublishing = new DelayedPromise<void>();
  readonly continuePublishing = new DelayedPromise<void>();
  readonly resumedRegistered = new DelayedPromise<void>();
  readonly firstSuspended = new DelayedPromise<void>();
  #firstStreamId: string | undefined;

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const data = event.data;
    if (data?.type === 'run-registered') this.#firstStreamId ??= data.streamId;
    if (data?.type === 'stream-part' && data.part?.type === 'start' && data.streamId === this.#firstStreamId) {
      this.startedPublishing.resolve();
      await this.continuePublishing.promise;
    }
    await super.publish(topic, event);
    if (data?.type === 'run-registered' && data.streamId !== this.#firstStreamId) this.resumedRegistered.resolve();
    if (data?.type === 'run-suspended' && data.streamId === this.#firstStreamId) this.firstSuspended.resolve();
  }
}

async function publishFromAnotherInstance(pubsub: RetainingLeasePubSub, streams: Record<string, unknown>[][]) {
  await pubsub.acquireLease(threadKey, runId);
  for (const [index, events] of streams.entries()) {
    const streamId = `triage-stream-${index + 1}`;
    await pubsub.publish(threadTopic, {
      type: 'agent.thread-stream',
      runId,
      data: { type: 'run-registered', runId, streamId, streamSeq: index + 1, sourceId: 'instance-a' },
    });
    for (const event of events) {
      await pubsub.publish(threadTopic, {
        type: 'agent.thread-stream',
        runId,
        data: { ...event, runId, streamId, sourceId: 'instance-a' },
      });
    }
  }
  await pubsub.releaseLease(threadKey, runId);
}

const finishPart = {
  type: 'stream-part',
  part: { type: 'finish', runId, payload: { stepResult: { reason: 'stop' } } },
};
const completed = { type: 'run-completed', persisted: true };
const approvalPart = {
  type: 'stream-part',
  part: {
    type: 'tool-call-approval',
    runId,
    payload: { toolCallId: 'call-1', toolName: TOOL_NAME, args: { stage: 'Planning' } },
  },
};
const suspendedPart = {
  type: 'stream-part',
  part: {
    type: 'tool-call-suspended',
    runId,
    payload: {
      toolCallId: 'call-1',
      toolName: TOOL_NAME,
      args: { stage: 'Planning' },
      suspendPayload: { question: 'Which stage?' },
    },
  },
};

async function createSessionOn(
  pubsub: LeasePubSub,
  storage = new InMemoryStore(),
  requestTool = false,
  continuation?: { entered: DelayedPromise<void>; released: DelayedPromise<void> },
) {
  let modelCalls = 0;
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
      doStream: async () => {
        const asksForTool = requestTool && modelCalls++ === 0;
        if (!asksForTool && continuation) {
          continuation.entered.resolve();
          await continuation.released.promise;
        }
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              if (asksForTool) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'call-pending',
                  toolName: TOOL_NAME,
                  input: '{"stage":"Planning"}',
                });
              }
              controller.enqueue({
                type: 'finish',
                finishReason: asksForTool ? 'tool-calls' : 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    }),
    tools: { [TOOL_NAME]: transition },
    pubsub,
  });
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
  const firstAgentEnd = new DelayedPromise<void>();
  const approvalRequired = new DelayedPromise<void>();
  session.subscribe((event: AgentControllerEvent) => {
    events.push(event);
    if (event.type === 'agent_end') firstAgentEnd.resolve();
    if (event.type === 'tool_approval_required') approvalRequired.resolve();
  });
  cleanups.push(() => controller.destroy());
  cleanups.push(async () => session.stream.detach());
  return {
    session,
    events,
    agent,
    storage,
    firstAgentEnd: firstAgentEnd.promise,
    approvalRequired: approvalRequired.promise,
  };
}

describe('run engine: replayed tool gates', () => {
  it('does not auto-approve a tool from a completed run', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFromAnotherInstance(pubsub, [
      [approvalPart, { type: 'run-suspended' }],
      [finishPart, completed],
    ]);
    const { session, events, firstAgentEnd } = await createSessionOn(pubsub);
    await session.permissions.setForTool({ toolName: TOOL_NAME, policy: 'allow' });

    await session.thread.create({ id: threadId });
    await firstAgentEnd;

    expect(events.filter(event => event.type === 'error')).toEqual([]);
    expect(session.approval.isArmed()).toBe(false);
  });

  it('does not ask for human approval on a completed run', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFromAnotherInstance(pubsub, [[approvalPart, finishPart, completed]]);
    const { session, events, firstAgentEnd } = await createSessionOn(pubsub);

    await session.thread.create({ id: threadId });
    await firstAgentEnd;

    expect(events.some(event => event.type === 'tool_approval_required')).toBe(false);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it('does not park on a question already answered elsewhere', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFromAnotherInstance(pubsub, [
      [suspendedPart, { type: 'run-suspended' }],
      [finishPart, completed],
    ]);
    const { session, events, firstAgentEnd } = await createSessionOn(pubsub);

    await session.thread.create({ id: threadId });
    await firstAgentEnd;

    expect(events.some(event => event.type === 'tool_suspended')).toBe(false);
    expect(events.filter(event => event.type === 'agent_end')).not.toContainEqual(
      expect.objectContaining({ reason: 'suspended' }),
    );
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it('ignores a finished run approval while another run owns the thread', async () => {
    const pubsub = new RetainingLeasePubSub();
    await publishFromAnotherInstance(pubsub, [[approvalPart, finishPart, completed]]);
    await pubsub.acquireLease(threadKey, 'new-run');
    await pubsub.publish(threadTopic, {
      type: 'agent.thread-stream',
      runId: 'new-run',
      data: { type: 'run-registered', runId: 'new-run', streamId: 'new-stream', streamSeq: 1, sourceId: 'instance-b' },
    });
    const { session, events, firstAgentEnd } = await createSessionOn(pubsub);

    await session.thread.create({ id: threadId });
    await firstAgentEnd;

    expect(events.some(event => event.type === 'tool_approval_required')).toBe(false);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it.each(['ordinary', 'delayed'])(
    'ignores an answered approval during its held continuation (%s broadcast)',
    async order => {
      const pubsub = new PausedBroadcastPubSub();
      const continuation = { entered: new DelayedPromise<void>(), released: new DelayedPromise<void>() };
      const origin = await createSessionOn(pubsub, undefined, true, continuation);
      if (order === 'ordinary') pubsub.continuePublishing.resolve();
      const initial = await origin.agent.stream('Request a transition', {
        memory: { thread: threadId, resource: resourceId },
      });
      try {
        await pubsub.startedPublishing.promise;
        await initial._waitUntilFinished();
        expect(initial.status).toBe('suspended');
        if (order === 'ordinary') await pubsub.firstSuspended.promise;
        const resumed = await origin.agent.approveToolCall({
          runId: initial.runId,
          toolCallId: 'call-pending',
          memory: { thread: threadId, resource: resourceId },
        });
        try {
          await pubsub.resumedRegistered.promise;
          await continuation.entered.promise;
          pubsub.continuePublishing.resolve();
          await pubsub.firstSuspended.promise;
          const storedRuns = await origin.agent.listSuspendedRuns({ threadId, resourceId });
          expect(storedRuns.runs.find(run => run.runId === initial.runId)?.toolCalls).toContainEqual(
            expect.objectContaining({ toolCallId: 'call-pending' }),
          );
          const observer = await createSessionOn(pubsub.fork(), origin.storage);
          await observer.session.thread.create({ id: threadId });
          const outcome = await Promise.race([
            observer.firstAgentEnd.then(() => 'ignored'),
            observer.approvalRequired.then(() => 'asked-again'),
          ]);
          expect(outcome).toBe('ignored');
          expect(observer.session.displayState.get().isRunning).toBe(false);
          expect(observer.events.filter(event => event.type === 'error')).toEqual([]);
          await expect(
            origin.agent.sendStreamResume({
              runId: initial.runId,
              threadId,
              resourceId,
              toolCallId: 'call-pending',
              resumeData: { approved: true },
            }),
          ).rejects.toMatchObject({ id: 'AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN' });
        } finally {
          continuation.released.resolve();
          await resumed.consumeStream();
        }
      } finally {
        pubsub.continuePublishing.resolve();
        await initial.consumeStream();
      }
    },
  );

  it.each(['delivered', 'missing'])(
    'settles an answered suspension after its resume fails (old terminal %s)',
    async terminal => {
      const pubsub = new RetainingLeasePubSub();
      await publishFromAnotherInstance(pubsub, [
        terminal === 'delivered' ? [suspendedPart, { type: 'run-suspended' }] : [suspendedPart],
        [
          { type: 'stream-part', part: { type: 'error', runId, payload: { error: 'Resume failed' } } },
          { type: 'run-completed', persisted: false },
        ],
      ]);
      if (terminal === 'missing') {
        await pubsub.acquireLease(threadKey, runId);
        cleanups.push(async () => {
          await pubsub.releaseLease(threadKey, runId);
        });
      }
      const { session, events, firstAgentEnd } = await createSessionOn(pubsub);

      await session.thread.create({ id: threadId });
      await firstAgentEnd;

      expect(session.displayState.get().isRunning).toBe(false);
      expect(events.some(event => event.type === 'tool_suspended')).toBe(false);
    },
  );

  it('recovers a genuinely pending approval from another runtime state', async () => {
    const publisher = new RetainingLeasePubSub();
    const origin = await createSessionOn(publisher, undefined, true);
    const output = await origin.agent.stream('Request a transition', {
      memory: { thread: threadId, resource: resourceId },
    });
    cleanups.push(async () => {
      const declined = await origin.agent.declineToolCall({
        runId: output.runId,
        toolCallId: 'call-pending',
        memory: { thread: threadId, resource: resourceId },
      });
      await declined.consumeStream();
    });
    await output.consumeStream();
    expect((await origin.agent.listSuspendedRuns({ threadId, resourceId })).runs).toHaveLength(1);
    const { session, events, approvalRequired } = await createSessionOn(publisher.fork(), origin.storage);

    await session.thread.create({ id: threadId });
    await approvalRequired;

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'tool_approval_required',
        toolCallId: 'call-pending',
        toolName: TOOL_NAME,
      }),
    );
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it('keeps a real approval pending when execution finishes before its broadcast', async () => {
    const pubsub = new PausedBroadcastPubSub();
    const { session, agent, events, approvalRequired } = await createSessionOn(pubsub, undefined, true);
    await session.thread.create({ id: threadId });
    const output = await agent.stream('Request a transition', {
      memory: { thread: threadId, resource: resourceId },
    });
    try {
      await pubsub.startedPublishing.promise;
      await output._waitUntilFinished();
      pubsub.continuePublishing.resolve();
      await approvalRequired;

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'tool_approval_required',
          toolCallId: 'call-pending',
          toolName: TOOL_NAME,
        }),
      );
      expect(events.filter(event => event.type === 'error')).toEqual([]);
    } finally {
      pubsub.continuePublishing.resolve();
      await output.consumeStream();
      const declined = await agent.declineToolCall({
        runId: output.runId,
        toolCallId: 'call-pending',
        memory: { thread: threadId, resource: resourceId },
      });
      await declined.consumeStream();
    }
  }, 5_000);
});
