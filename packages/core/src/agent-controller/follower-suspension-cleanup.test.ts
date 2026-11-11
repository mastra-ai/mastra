/**
 * A Session that follows a thread mirrors tool suspensions from runs started on
 * another instance (shared pubsub + storage). When that run is resumed there and
 * completes, the follower must drop its mirror instead of keeping a stale call.
 * When the run is aborted elsewhere or ends with a non-success finish, the
 * follower must retract the call with a cancellation event, once. Both a
 * second instance and a second Session on the same controller are covered.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import type { Processor } from '../processors';
import { InMemoryStore } from '../storage/mock';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const resourceId = 'follow-user';
const threadId = 'follow-thread';

function model(answeredFinishReason: 'stop' | 'content-filter') {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const answered = JSON.stringify(prompt).includes('"type":"tool-result"');
      const parts = answered
        ? [
            { type: 'text-start' as const, id: 't' },
            { type: 'text-delta' as const, id: 't', delta: 'done' },
            { type: 'text-end' as const, id: 't' },
            { type: 'finish' as const, finishReason: answeredFinishReason, usage },
          ]
        : [
            { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'ask', input: '{"q":"x"}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

async function setup({ answeredFinishReason = 'stop' as 'stop' | 'content-filter' } = {}) {
  const storage = new InMemoryStore();
  const memoryStorage = new InMemoryStore();
  const pubsub = new EventEmitterPubSub();

  const boot = async (instance: string) => {
    const ask = createTool({
      id: 'ask',
      description: 'ask the user',
      inputSchema: z.object({ q: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (_input, context) => {
        const resumeData = context?.agent?.resumeData as { answer: string } | undefined;
        if (!resumeData) return context?.agent?.suspend?.({ question: 'what?' });
        return { answer: resumeData.answer };
      },
    });
    const agent = new Agent({
      id: 'follow-agent',
      name: 'follow-agent',
      instructions: 'test',
      model: model(answeredFinishReason),
      tools: { ask },
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'follow-controller',
      storage,
      pubsub,
      memory: new MockMemory({ storage: memoryStorage }),
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: `session-${instance}`,
      ownerId: 'owner',
      resourceId,
      threadId,
    });
    await controller.getMastra()?.startWorkers();
    const events: AgentControllerEvent[] = [];
    session.subscribe(e => events.push(e));
    return { session, events };
  };

  const { session: a, events: aEvents } = await boot('a');
  const { session: b, events: bEvents } = await boot('b');
  return { a, b, aEvents, bEvents };
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('follower Session suspension cleanup', () => {
  it('drops the mirrored suspension once the run is resumed elsewhere and completes', async () => {
    const { a, b, aEvents, bEvents } = await setup();

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(b.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
    await vi.waitFor(() => expect(a.suspensions.hasPending()).toBe(true), { timeout: 10_000 });

    await a.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { answer: 'yes' } });

    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'complete')).toBe(true),
      { timeout: 10_000 },
    );
    await vi.waitFor(() =>
      expect(aEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'complete')).toBe(true),
    );

    expect(b.suspensions.hasPending()).toBe(false);
    expect(b.suspensions.get({ toolCallId: 'call-1' })).toBeUndefined();
    expect(b.displayState.get().pendingSuspensions.size).toBe(0);
    expect(bEvents.some(e => e.type === 'tool_suspension_cancelled')).toBe(false);

    const before = bEvents.length;
    await b.abortRun();
    expect(bEvents.slice(before).some(e => e.type === 'tool_suspension_cancelled')).toBe(false);
  }, 30_000);

  it('keeps the mirrored suspension while the run stays suspended', async () => {
    const { a, b, bEvents } = await setup();

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'suspended')).toBe(true),
      { timeout: 10_000 },
    );

    expect(b.suspensions.hasPending()).toBe(true);
    expect(b.displayState.get().pendingSuspensions.size).toBe(1);
  }, 30_000);

  it('retracts the mirrored suspension when another Session aborts the parked run', async () => {
    const { a, b, aEvents, bEvents } = await setup();

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(b.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
    await vi.waitFor(() => expect(a.suspensions.hasPending()).toBe(true), { timeout: 10_000 });

    await a.abortRun();

    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'aborted')).toBe(true),
      { timeout: 10_000 },
    );

    expect(b.suspensions.hasPending()).toBe(false);
    expect(b.suspensions.get({ toolCallId: 'call-1' })).toBeUndefined();
    expect(b.displayState.get().pendingSuspensions.size).toBe(0);
    expect(
      bEvents.filter(e => e.type === 'tool_suspension_cancelled' && (e as any).toolCallId === 'call-1'),
    ).toHaveLength(1);
  }, 30_000);

  it('retracts the mirrored suspension when the resumed run ends with a non-success finish', async () => {
    const { a, b, bEvents } = await setup({ answeredFinishReason: 'content-filter' });

    void a.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(b.suspensions.hasPending()).toBe(true), { timeout: 10_000 });
    await vi.waitFor(() => expect(a.suspensions.hasPending()).toBe(true), { timeout: 10_000 });

    await a.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { answer: 'yes' } });

    await vi.waitFor(
      () => expect(bEvents.some(e => e.type === 'agent_end' && (e as any).reason === 'error')).toBe(true),
      { timeout: 10_000 },
    );

    expect(b.suspensions.hasPending()).toBe(false);
    expect(b.suspensions.get({ toolCallId: 'call-1' })).toBeUndefined();
    expect(b.displayState.get().pendingSuspensions.size).toBe(0);
    expect(
      bEvents.filter(e => e.type === 'tool_suspension_cancelled' && (e as any).toolCallId === 'call-1'),
    ).toHaveLength(1);

    const before = bEvents.length;
    await b.abortRun();
    expect(bEvents.slice(before).some(e => e.type === 'tool_suspension_cancelled')).toBe(false);
  }, 30_000);
});

function createToolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'confirmAction',
        input: '{"action":"deploy"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream(finishReason: 'stop' | 'content-filter' = 'stop') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Deployed successfully.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

/**
 * Two Sessions bound to one thread through a shared PubSub. Session A starts the
 * run and answers the call; Session B only follows. The run is parked on a
 * resume-aware `confirmAction` suspension (`call-1`) once the helper returns.
 * The resumed run ends with `resumedFinishReason`.
 */
async function createParkedRunWithFollower(
  id: string,
  {
    resumedFinishReason = 'stop',
    inputProcessors,
  }: { resumedFinishReason?: 'stop' | 'content-filter'; inputProcessors?: Processor[] } = {},
) {
  const confirmTool = createTool({
    id: 'confirm-action',
    description: 'Confirms an action with the user',
    inputSchema: z.object({ action: z.string() }),
    execute: async (input: { action: string }, context?: any) => {
      const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
      if (resumeData) {
        return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
      }
      const suspend = context?.suspend ?? context?.agent?.suspend;
      if (!suspend) throw new Error('suspend not available in context');
      await suspend({ action: input.action });
      return { result: `Action "${input.action}" confirmed` };
    },
  });

  const agent = new Agent({
    id: `test-agent-${id}`,
    name: `Test Agent ${id}`,
    instructions: 'You confirm actions.',
    model: new MastraLanguageModelV2Mock({
      doStream: (() => {
        let callCount = 0;
        return async () => {
          callCount++;
          return { stream: callCount === 1 ? createToolCallStream() : createTextStream(resumedFinishReason) };
        };
      })(),
    }),
    tools: { confirmAction: confirmTool },
    inputProcessors,
  });

  const storage = new InMemoryStore();
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ agents: { [`test-agent-${id}`]: agent }, logger: false, storage, pubsub });
  const registeredAgent = mastra.getAgent(`test-agent-${id}`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `test-controller-${id}`,
    storage,
    pubsub,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();

  const sessionA = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', scope: 'a' });
  const sessionB = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', scope: 'b' });
  const eventsA: AgentControllerEvent[] = [];
  const eventsB: AgentControllerEvent[] = [];
  sessionA.subscribe(event => {
    eventsA.push(event);
  });
  sessionB.subscribe(event => {
    eventsB.push(event);
  });

  await sessionA.thread.create();
  await sessionB.thread.switch({ threadId: sessionA.thread.requireId() });

  await sessionA.sendMessage({ content: 'Deploy to production' });
  await vi.waitFor(() => expect(sessionB.suspensions.hasPending()).toBe(true));
  await vi.waitFor(() => expect(eventsB.find(e => e.type === 'agent_end')?.reason).toBe('suspended'));
  expect(eventsA.find(e => e.type === 'agent_end')?.reason).toBe('suspended');

  eventsA.length = 0;
  eventsB.length = 0;
  return { sessionA, sessionB, eventsA, eventsB };
}

const cancelledToolCalls = (events: AgentControllerEvent[]) =>
  events.filter(e => e.type === 'tool_suspension_cancelled').map(e => (e as { toolCallId: string }).toolCallId);

describe('follower Session on the same controller: run aborted or failed by another Session', () => {
  it('Given a follower Session, When another Session aborts the parked run, Then the follower retracts the suspension once (#26997)', async () => {
    const { sessionA, sessionB, eventsA, eventsB } = await createParkedRunWithFollower('aborted-elsewhere');

    sessionA.abortRun();
    await vi.waitFor(() => expect(eventsB.find(e => e.type === 'agent_end')?.reason).toBe('aborted'));

    expect(cancelledToolCalls(eventsA)).toEqual(['call-1']);
    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
    expect(sessionB.suspensions.hasPending()).toBe(false);
    expect(sessionB.displayState.get().pendingSuspensions.size).toBe(0);

    // The later abort of the follower has nothing left to retract.
    sessionB.abortRun();
    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
  });

  it('Given a follower Session, When the follower aborts the parked run itself, Then the suspension is retracted once (#26997)', async () => {
    const { sessionB, eventsB } = await createParkedRunWithFollower('aborted-by-follower');

    sessionB.abortRun();
    await vi.waitFor(() => expect(eventsB.find(e => e.type === 'agent_end')?.reason).toBe('aborted'));

    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
    expect(sessionB.suspensions.hasPending()).toBe(false);
    expect(sessionB.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('Given a follower Session, When the call is answered on another Session and the resumed run ends in a non-success finish, Then the follower retracts the suspension once (#26997)', async () => {
    const { sessionA, sessionB, eventsA, eventsB } = await createParkedRunWithFollower('answered-then-error', {
      resumedFinishReason: 'content-filter',
    });

    await sessionA.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { confirmed: true } });
    await vi.waitFor(() => expect(eventsB.find(e => e.type === 'agent_end')?.reason).toBe('error'));

    expect(eventsA.find(e => e.type === 'agent_end')?.reason).toBe('error');
    expect(eventsB.filter(e => e.type === 'error')).toHaveLength(1);
    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
    expect(sessionB.suspensions.hasPending()).toBe(false);
    expect(sessionB.suspensions.get({ toolCallId: 'call-1' })).toBeUndefined();
    expect(sessionB.displayState.get().pendingSuspensions.size).toBe(0);

    // The later abort of the follower has nothing left to retract.
    sessionB.abortRun();
    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
  });

  it('Given a follower Session, When the resumed run ends in a processor tripwire, Then the suspension is retracted once (#26997)', async () => {
    let tripwire = false;
    const { sessionA, sessionB, eventsB } = await createParkedRunWithFollower('answered-then-tripwire', {
      inputProcessors: [
        {
          id: 'resumed-step-guard',
          processInputStep: async ({ abort }) => {
            if (tripwire) abort('database is locked');
            return {};
          },
        },
      ],
    });

    tripwire = true;
    await sessionA.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { confirmed: true } });
    await vi.waitFor(() => expect(eventsB.find(e => e.type === 'agent_end')?.reason).toBe('error'));

    expect(cancelledToolCalls(eventsB)).toEqual(['call-1']);
    expect(sessionB.suspensions.hasPending()).toBe(false);
    expect(sessionB.displayState.get().pendingSuspensions.size).toBe(0);
  });
});
