/**
 * Regression tests for #20592 — `session.abort()` during a tool-approval gate or
 * a parked tool suspension.
 *
 * Bug 1: aborting synchronously from inside a `tool_approval_required`
 *        subscriber surfaced an `error` event (the engine still drove the
 *        agent's decline path on a run that was already being torn down).
 * Bug 2: after aborting an approval the display state kept rendering the gated
 *        tool as pending instead of settling it.
 * Bug 3: after aborting a parked suspension the tool stayed stuck forever.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { SUSPENDED_RUN_MEMORY_KEY } from '../session';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

function toolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'findUser',
        input: '{"name":"Dero"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

function textStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

async function createHarness(id: string, durable: boolean) {
  const findUser = createTool({
    id: 'find-user',
    description: 'Look up a user by name.',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async (_input: { name: string }, context?: any) => {
      const suspend = context?.suspend ?? context?.agent?.suspend;
      await suspend({ reason: 'needs input' });
      return { email: 'dero@example.com' };
    },
  });

  const storage = new InMemoryStore();
  let callCount = 0;
  const baseAgent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You look up users.',
    memory: new MockMemory({ storage }),
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        return { stream: callCount === 1 ? toolCallStream() : textStream() };
      },
    }),
    tools: { findUser },
  });

  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const agent = durable ? createDurableAgent({ agent: baseAgent, cache, pubsub }) : baseAgent;
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent as any }, logger: false, storage, cache, pubsub });
  const registeredAgent = mastra.getAgent(`${id}-agent`);

  const controller = new AgentController({
    agent: registeredAgent,
    pubsub,
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  return { controller, session, agent: registeredAgent, events: [] as AgentControllerEvent[] };
}

function waitForAgentEnd(session: any, events: AgentControllerEvent[]) {
  return new Promise<void>(resolve => {
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
      if (event.type === 'agent_end' && event.reason === 'aborted') resolve();
    });
  });
}

describe.each([false, true])('session.abort() during approval / suspension (#20592), durable=%s', durable => {
  it('Given a tool awaiting approval, When abort() is called synchronously from the subscriber, Then the run aborts without an error event', async () => {
    const { session, events } = await createHarness('abort-approval', durable);

    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') session.abort();
    });

    void session.sendMessage({ content: 'find dero' }).catch(() => {});
    await ended;

    expect(events.filter(e => e.type === 'error')).toEqual([]);
    expect(events.find(e => e.type === 'agent_end')).toEqual({ type: 'agent_end', reason: 'aborted' });
  });

  it('Given an aborted approval, When agent_end fires, Then the display state no longer shows the tool as pending', async () => {
    const { session, events } = await createHarness('abort-approval-ds', durable);

    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') session.abort();
    });

    void session.sendMessage({ content: 'find dero' }).catch(() => {});
    await ended;

    const ds = session.displayState.get();
    expect(ds.pendingApproval).toBeNull();
    expect(ds.isRunning).toBe(false);

    // The gated call must be settled rather than left rendering as in-flight.
    const tool = ds.activeTools.get('call-1');
    expect(tool?.status).not.toBe('running');
    expect(tool?.status).not.toBe('streaming_input');

    const parts = (ds.currentMessage?.content.parts ?? []).filter(part => part.type === 'tool-invocation');
    expect(parts).toHaveLength(1);
    expect((parts[0] as any).toolInvocation.state).toBe('output-denied');
  });

  it('Given two subscribers that both abort a parked approval, When the run ends, Then it still aborts without an error event', async () => {
    const { session, events } = await createHarness('abort-approval-twice', durable);

    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') session.abort();
    });
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') session.abort();
    });

    void session.sendMessage({ content: 'find dero' }).catch(() => {});
    await ended;

    expect(events.filter(e => e.type === 'error')).toEqual([]);
    expect(events.find(e => e.type === 'agent_end')).toEqual({ type: 'agent_end', reason: 'aborted' });
  });

  it('Given an approved tool parked in suspend(), When abort() is called, Then the parked suspension is retracted from the display state', async () => {
    const { session, agent, events } = await createHarness('abort-suspension', durable);

    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') {
        void session.respondToToolApproval({ decision: 'approve' });
      }
      if (!durable && event.type === 'agent_end' && event.reason === 'suspended') session.abort();
    });

    const sending = session.sendMessage({ content: 'find dero' });
    if (durable) {
      await vi.waitFor(
        async () => {
          const parked = await agent.listSuspendedRuns({});
          expect(
            parked.runs.some((run: { toolCalls: Array<{ toolCallId: string; requiresApproval?: boolean }> }) =>
              run.toolCalls.some(tool => tool.toolCallId === 'call-1' && !tool.requiresApproval),
            ),
          ).toBe(true);
        },
        { timeout: 5000 },
      );
      session.abort();
      await vi.waitFor(() => expect(session.displayState.get().pendingSuspensions.size).toBe(0));
    } else {
      await ended;
    }
    await sending;

    const ds = session.displayState.get();
    expect(ds.pendingSuspensions.size).toBe(0);
    expect(ds.isRunning).toBe(false);
    expect(events.some(e => e.type === 'tool_suspension_cancelled')).toBe(true);

    const messages = await session.thread.listMessages({ threadId: session.thread.requireId() });
    const persistedToolParts = messages
      .filter(message => message.role === 'assistant')
      .flatMap(message => message.content.parts)
      .filter(part => part.type === 'tool-invocation');
    expect(persistedToolParts).toHaveLength(1);
    expect(persistedToolParts[0]?.toolInvocation).toMatchObject({
      state: 'output-denied',
      approval: { approved: false, reason: 'Aborted by the user' },
    });
  });

  it('Given an approval gate and a retained suspended tool, When abort() is called, Then both tool calls are denied before teardown', async () => {
    const { controller, session, events } = await createHarness('abort-approval-and-suspension', durable);

    const ended = waitForAgentEnd(session, events);
    let sawCombinedState = false;
    const combinedStateReady = new Promise<void>((resolve, reject) => {
      session.subscribe((event: AgentControllerEvent) => {
        if (event.type !== 'tool_approval_required') return;

        void (async () => {
          try {
            const currentMessage = session.displayState.get().currentMessage;
            if (!currentMessage) throw new Error('Expected an active approval message');

            // The controller can retain a persisted suspension from an earlier
            // tool step while a later tool is awaiting approval.
            const suspendedMessage = structuredClone(currentMessage);
            suspendedMessage.id = `${currentMessage.id}-suspended`;
            suspendedMessage.threadId = session.thread.requireId();
            suspendedMessage.resourceId = session.identity.getResourceId();
            suspendedMessage.content.parts = [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolCallId: 'call-2',
                  toolName: 'confirmAccess',
                  args: { resource: 'profile' },
                },
              },
            ];
            const memory = await session.machinery.getAgent().getMemory();
            if (!memory) throw new Error('Expected memory for persisted suspension');
            await memory.saveMessages({ messages: [suspendedMessage] });

            session.suspensions.register({
              toolCallId: 'call-2',
              runId: 'retained-suspended-run',
              toolName: 'confirmAccess',
              threadId: session.thread.requireId(),
              resourceId: session.identity.getResourceId(),
            });
            sawCombinedState = session.approval.isArmed() && session.suspensions.hasPending();
            session.abort();
            resolve();
          } catch (error) {
            reject(error);
          }
        })();
      });
    });

    void session.sendMessage({ content: 'find dero' }).catch(() => {});
    await combinedStateReady;
    await ended;

    expect(sawCombinedState).toBe(true);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
    expect(events.some(event => event.type === 'tool_suspension_cancelled' && event.toolCallId === 'call-2')).toBe(
      true,
    );
    expect(events.some(event => event.type === 'tool_end' && event.toolCallId === 'call-2' && event.denied)).toBe(true);

    await vi.waitFor(async () => {
      const messages = await session.thread.listMessages({ threadId: session.thread.requireId() });
      const persistedToolParts = messages
        .filter(message => message.role === 'assistant')
        .flatMap(message => message.content.parts)
        .filter(part => part.type === 'tool-invocation');
      expect(
        persistedToolParts
          .map(part => ({ toolCallId: part.toolInvocation.toolCallId, state: part.toolInvocation.state }))
          .sort((a, b) => a.toolCallId.localeCompare(b.toolCallId)),
      ).toEqual([
        { toolCallId: 'call-1', state: 'output-denied' },
        { toolCallId: 'call-2', state: 'output-denied' },
      ]);
    });

    const ds = session.displayState.get();
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingSuspensions.size).toBe(0);
    expect(ds.isRunning).toBe(false);
    expect(controller.listActiveThreadRuns()).toHaveLength(0);
  });

  it('Given a suspension persisted under an earlier thread, When the rebound session aborts, Then settlement writes the original thread and not the current one', async () => {
    const { controller, session, events } = await createHarness('abort-cross-thread-suspension', durable);

    // Persist a suspended invocation under the original thread/resource (A).
    const threadA = session.thread.requireId();
    const resourceId = session.identity.getResourceId();
    const memory = await session.machinery.getAgent().getMemory();
    if (!memory) throw new Error('Expected memory for persisted suspension');
    const suspendedMessage = {
      id: 'suspended-message-a',
      role: 'assistant' as const,
      createdAt: new Date(),
      threadId: threadA,
      resourceId,
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'call' as const,
              toolCallId: 'call-2',
              toolName: 'confirmAccess',
              args: { resource: 'profile' },
            },
          },
        ],
      },
    };
    await memory.saveMessages({ messages: [suspendedMessage as any] });
    session.suspensions.register({
      toolCallId: 'call-2',
      runId: 'retained-suspended-run',
      toolName: 'confirmAccess',
      threadId: threadA,
      resourceId,
    });

    // Rebind the session to a new thread (B). Suspensions survive rebinding.
    await session.thread.create();
    const threadB = session.thread.requireId();
    expect(threadB).not.toBe(threadA);
    expect(session.suspensions.hasPending()).toBe(true);

    // Drive the approval-gate abort path on thread B.
    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') session.abort();
    });
    void session.sendMessage({ content: 'find dero' }).catch(() => {});
    await ended;

    expect(events.filter(event => event.type === 'error')).toEqual([]);
    expect(events.some(event => event.type === 'tool_end' && event.toolCallId === 'call-2' && event.denied)).toBe(true);

    // The invocation persisted under thread A is settled in place.
    await vi.waitFor(async () => {
      const messagesA = await session.thread.listMessages({ threadId: threadA });
      const partsA = messagesA
        .flatMap(message => message.content.parts)
        .filter(part => part.type === 'tool-invocation');
      expect(partsA).toHaveLength(1);
      expect(partsA[0]?.toolInvocation).toMatchObject({
        toolCallId: 'call-2',
        state: 'output-denied',
        approval: { approved: false, reason: 'Aborted by the user' },
      });
    });

    // Thread B only holds its own gated call (denied); A's message never leaks in.
    await vi.waitFor(async () => {
      const messagesB = await session.thread.listMessages({ threadId: threadB });
      const partsB = messagesB
        .flatMap(message => message.content.parts)
        .filter(part => part.type === 'tool-invocation');
      expect(partsB.map(part => part.toolInvocation.toolCallId)).toEqual(['call-1']);
      expect(partsB[0]?.toolInvocation.state).toBe('output-denied');
      expect(messagesB.some(message => message.id === 'suspended-message-a')).toBe(false);
    });

    const ds = session.displayState.get();
    expect(ds.pendingApproval).toBeNull();
    expect(ds.pendingSuspensions.size).toBe(0);
    expect(ds.isRunning).toBe(false);
    expect(session.suspensions.hasPending()).toBe(false);
    expect(controller.listActiveThreadRuns()).toHaveLength(0);
  });

  it('Given a suspension whose run scope carries its own memory, When abort() settles it, Then settlement writes through the stashed memory', async () => {
    const { controller, session, events } = await createHarness('abort-stashed-memory', durable);

    const threadId = session.thread.requireId();
    const resourceId = session.identity.getResourceId();

    // The suspended invocation lives in a memory the session agent does NOT
    // resolve to — as with a dynamic `memory: ({ requestContext }) => ...`
    // config, only the memory captured at suspension time can reach it.
    const stashedMemory = new MockMemory({ storage: new InMemoryStore() });
    const suspendedMessage = {
      id: 'suspended-message-stashed',
      role: 'assistant' as const,
      createdAt: new Date(),
      threadId,
      resourceId,
      content: {
        format: 2 as const,
        parts: [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'call' as const,
              toolCallId: 'call-2',
              toolName: 'confirmAccess',
              args: { resource: 'profile' },
            },
          },
        ],
      },
    };
    await stashedMemory.saveMessages({ messages: [suspendedMessage as any] });

    const mastra = controller.getMastra();
    if (!mastra) throw new Error('Expected the controller to own a Mastra instance');
    const runScope = mastra.__createRunScope('stashed-memory-run');
    runScope.set(SUSPENDED_RUN_MEMORY_KEY, stashedMemory);
    session.suspensions.register({
      toolCallId: 'call-2',
      runId: 'stashed-memory-run',
      toolName: 'confirmAccess',
      threadId,
      resourceId,
    });

    try {
      const ended = waitForAgentEnd(session, events);
      session.subscribe((event: AgentControllerEvent) => {
        if (event.type === 'tool_approval_required') session.abort();
      });
      void session.sendMessage({ content: 'find dero' }).catch(() => {});
      await ended;

      expect(events.filter(event => event.type === 'error')).toEqual([]);
      expect(events.some(event => event.type === 'tool_end' && event.toolCallId === 'call-2' && event.denied)).toBe(
        true,
      );

      // Settlement read and wrote the stashed memory: the invocation it holds
      // is denied in place. A fallback to the session agent's memory would
      // have found nothing and left this in state 'call'.
      await vi.waitFor(async () => {
        const { messages } = await stashedMemory.recall({ threadId, resourceId });
        const parts = messages
          .flatMap(message => message.content.parts)
          .filter(part => part.type === 'tool-invocation');
        expect(parts).toHaveLength(1);
        expect(parts[0]?.toolInvocation).toMatchObject({
          toolCallId: 'call-2',
          state: 'output-denied',
          approval: { approved: false, reason: 'Aborted by the user' },
        });
      });

      // The session agent's own memory was never written for call-2.
      const sessionMessages = await session.thread.listMessages({ threadId });
      const sessionParts = sessionMessages
        .flatMap(message => message.content.parts)
        .filter(part => part.type === 'tool-invocation');
      expect(sessionParts.map(part => part.toolInvocation.toolCallId)).toEqual(['call-1']);
      expect(sessionMessages.some(message => message.id === 'suspended-message-stashed')).toBe(false);

      expect(session.suspensions.hasPending()).toBe(false);
      expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    } finally {
      mastra.__releaseRunScope('stashed-memory-run');
    }
  });
});
