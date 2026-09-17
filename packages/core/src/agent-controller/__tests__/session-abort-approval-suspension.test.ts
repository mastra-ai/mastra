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
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
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

async function createHarness(id: string, { withMemory = true } = {}) {
  const findUser = createTool({
    id: 'find-user',
    description: 'Look up a user by name.',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: withMemory,
    execute: async (_input: { name: string }, context?: any) => {
      const suspend = context?.suspend ?? context?.agent?.suspend;
      await suspend({ reason: 'needs input' });
      return { email: 'dero@example.com' };
    },
  });

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  let callCount = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You look up users.',
    memory: withMemory ? memory : undefined,
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        return { stream: callCount === 1 ? toolCallStream() : textStream() };
      },
    }),
    tools: { findUser },
  });

  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  return { session, memory, agent: registeredAgent, events: [] as AgentControllerEvent[] };
}

function waitForAgentEnd(session: any, events: AgentControllerEvent[]) {
  return new Promise<void>(resolve => {
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
      if (event.type === 'agent_end' && event.reason === 'aborted') resolve();
    });
  });
}

describe('session.abort() during approval / suspension (#20592)', () => {
  it('Given a tool awaiting approval, When abort() is called synchronously from the subscriber, Then the run aborts without an error event', async () => {
    const { session, events } = await createHarness('abort-approval');

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
    const { session, events } = await createHarness('abort-approval-ds');

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
    const { session, events } = await createHarness('abort-approval-twice');

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
    const { session, events } = await createHarness('abort-suspension');

    const ended = waitForAgentEnd(session, events);
    session.subscribe((event: AgentControllerEvent) => {
      if (event.type === 'tool_approval_required') {
        void session.respondToToolApproval({ decision: 'approve' });
      }
      if (event.type === 'agent_end' && event.reason === 'suspended') session.abort();
    });

    await session.sendMessage({ content: 'find dero' });
    await ended;

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

  it('waits for persistence despite reentrant and repeated aborts, then accepts another message', async () => {
    const { session, memory, events } = await createHarness('abort-delayed-save');
    const ended = waitForAgentEnd(session, events);
    session.subscribe(event => {
      if (event.type === 'tool_approval_required') void session.respondToToolApproval({ decision: 'approve' });
      if (event.type === 'tool_suspension_cancelled') session.abort();
    });
    await session.sendMessage({ content: 'find dero' });

    let releaseSave!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    let saveStarted!: () => void;
    const started = new Promise<void>(resolve => {
      saveStarted = resolve;
    });
    const save = memory.saveMessages.bind(memory);
    const spy = vi.spyOn(memory, 'saveMessages').mockImplementationOnce(async input => {
      saveStarted();
      await gate;
      return save(input);
    });
    session.abort();
    await started;
    session.abort();
    expect(events.filter(event => event.type === 'agent_end' && event.reason === 'aborted')).toHaveLength(0);
    releaseSave();
    await ended;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(events.filter(event => event.type === 'tool_end' && event.denied)).toHaveLength(1);
    expect(events.filter(event => event.type === 'error')).toEqual([]);
    const recalled = await memory.recall({ threadId: session.thread.requireId() });
    expect(recalled.messages.flatMap(message => message.content.parts)).toContainEqual(
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({ state: 'output-denied' }),
      }),
    );
    spy.mockRestore();
    await session.sendMessage({ content: 'continue' });
    expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true);
  });

  it('emits a settled message without memory', async () => {
    const { session, events } = await createHarness('abort-no-memory', { withMemory: false });
    const ended = waitForAgentEnd(session, events);
    session.subscribe(event => {
      if (event.type === 'tool_approval_required') void session.respondToToolApproval({ decision: 'approve' });
    });
    await session.sendMessage({ content: 'find dero' });
    session.abort();
    await ended;
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'message_update',
        message: expect.objectContaining({
          content: expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                type: 'tool-invocation',
                toolInvocation: expect.objectContaining({ state: 'output-denied' }),
              }),
            ]),
          }),
        }),
      }),
    );
    expect(events.filter(event => event.type === 'error')).toEqual([]);
  });

  it('reports a failed save and still releases the aborted run', async () => {
    const { session, memory, events } = await createHarness('abort-save-failure');
    const ended = waitForAgentEnd(session, events);
    session.subscribe(event => {
      if (event.type === 'tool_approval_required') void session.respondToToolApproval({ decision: 'approve' });
    });
    await session.sendMessage({ content: 'find dero' });
    const error = new Error('save failed');
    const spy = vi.spyOn(memory, 'saveMessages').mockRejectedValueOnce(error);
    session.abort();
    await ended;
    expect(events).toContainEqual({ type: 'error', error });
    expect(session.displayState.get().isRunning).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    spy.mockRestore();
  });
});
