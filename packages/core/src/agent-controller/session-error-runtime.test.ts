import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function stream(kind: 'error' | 'partial' | 'finish' | 'tool' | 'success') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      if (kind === 'tool') {
        controller.enqueue({ type: 'tool-call', toolCallId: 'call-1', toolName: 'confirm', input: '{}' });
      } else if (kind !== 'error') {
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Some output' });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
      }
      if (kind === 'error' || kind === 'partial') {
        controller.enqueue({ type: 'error', error: new Error('Provider unavailable') });
      } else {
        controller.enqueue({
          type: 'finish',
          finishReason: kind === 'finish' ? 'content-filter' : kind === 'tool' ? 'tool-calls' : 'stop',
          usage: { inputTokens: 10, outputTokens: 5 },
        });
      }
      controller.close();
    },
  });
}

async function setup(kind: Parameters<typeof stream>[0]) {
  const model = new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: stream(kind) }) });
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'runtime-errors',
    name: 'Runtime errors',
    instructions: 'Test',
    model,
    memory: new MockMemory({ storage }),
    tools: {
      confirm: createTool({
        id: 'confirm',
        description: 'Confirm',
        inputSchema: z.object({}),
        execute: async (_, context) => {
          await context?.agent?.suspend({ confirm: true });
          return 'confirmed';
        },
      }),
    },
  });
  new Mastra({ agents: { agent }, storage, logger: false });
  const controller = new AgentController({
    id: 'runtime-errors',
    storage,
    workspace: createMockWorkspace(),
    modes: [{ id: 'default', default: true, agent }],
    initialState: { yolo: true },
  });
  await controller.init();
  const session = await controller.createSession({ resourceId: 'resource', scope: 'first' });
  await session.thread.create();
  return { controller, session, agent, storage, model };
}

function errors(
  messages: Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['session']['thread']['listActiveMessages']>>,
) {
  return messages.filter(message => message.content.parts.some(part => part.type === 'data-session-error'));
}

describe('session error production paths', () => {
  it('does not finish or reset a replacement run when an old error write completes', async () => {
    const { controller, session, storage } = await setup('error');
    const originalThreadId = session.thread.getId()!;
    const memoryStorage = (await storage.getStore('memory'))!;
    const save = memoryStorage.saveMessages.bind(memoryStorage);
    const blocked = Promise.withResolvers<void>();
    const entered = Promise.withResolvers<void>();
    vi.spyOn(memoryStorage, 'saveMessages').mockImplementation(async input => {
      if (input.messages.some(message => message.content.parts.some(part => part.type === 'data-session-error'))) {
        entered.resolve();
        await blocked.promise;
      }
      return save(input);
    });
    const finished = vi.spyOn(session, 'finishAgentRun');
    await session.sendSignal({ content: 'Fail now' }).accepted;
    await entered.promise;
    await vi.waitFor(() => expect(finished).toHaveBeenCalled());
    const completion = finished.mock.results[0]!.value;
    await session.thread.create();
    session.run.nextOperation();
    session.run.setRunId({ runId: 'replacement' });
    session.run.ensureAbortController();
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    blocked.resolve();
    await completion;
    await session.drainErrorPersistence();
    expect(events.some(event => event.type === 'agent_end')).toBe(false);
    expect(session.run.getRunId()).toBe('replacement');
    expect(session.run.isRunning()).toBe(true);
    expect(errors(await session.thread.listMessages({ threadId: originalThreadId }))).toHaveLength(1);
    await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
  });

  it('does not reinstall the old subscription after a thread switch during resume preparation', async () => {
    const { controller, session, agent } = await setup('tool');
    await session.sendMessage({ content: 'Ask for confirmation' });
    const preparation = Promise.withResolvers<void>();
    const build = session.machinery.buildRequestContext.bind(session.machinery);
    const buildSpy = vi.spyOn(session.machinery, 'buildRequestContext').mockImplementationOnce(async input => {
      await preparation.promise;
      return build(input);
    });
    const resume = vi.spyOn(agent, 'sendStreamResume');
    const response = session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { approved: true } });
    await vi.waitFor(() => expect(buildSpy).toHaveBeenCalled());
    await session.thread.create();
    const ensure = vi.spyOn(session.thread, 'ensureSubscription');
    preparation.resolve();
    await response;
    expect(ensure).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
  });

  it('shares startup failure identity across subscribers and waits for durable cleanup', async () => {
    const { controller, session, agent } = await setup('success');
    vi.spyOn(agent, 'stream').mockRejectedValueOnce(new Error('Startup unavailable'));
    const threadId = session.thread.getId()!;
    const second = await controller.createSession({ resourceId: 'resource', scope: 'second', threadId });
    await second.thread.ensureCurrentSubscription();
    const firstEvents: AgentControllerEvent[] = [];
    const secondEvents: AgentControllerEvent[] = [];
    session.subscribe(event => {
      firstEvents.push(event);
    });
    second.subscribe(event => {
      secondEvents.push(event);
    });
    await session.sendMessage({ content: 'Fail at startup' }).catch(error => {
      expect(error.message).toContain('Startup unavailable');
    });
    await vi.waitFor(() => {
      expect(firstEvents.some(event => event.type === 'agent_end')).toBe(true);
      expect(secondEvents.some(event => event.type === 'agent_end')).toBe(true);
    });
    const first = firstEvents.filter(event => event.type === 'error');
    const other = secondEvents.filter(event => event.type === 'error');
    expect(first).toHaveLength(1);
    expect(other).toHaveLength(1);
    expect(other[0]?.occurrenceId).toBe(first[0]?.occurrenceId);
    expect(errors(await session.thread.listActiveMessages())).toHaveLength(1);
    await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
    await controller.deleteSession({ resourceId: 'resource', scope: 'second' });
  });

  it('keeps persisted error-only history out of the next successful provider request', async () => {
    const { controller, session, model } = await setup('success');
    await session.sendMessage({ content: 'Remember this earlier context' });
    const nextStream = vi.spyOn(model, 'doStream').mockResolvedValue({ stream: stream('error') });
    await session.sendMessage({ content: 'Fail now' });
    expect(errors(await session.thread.listActiveMessages())).toHaveLength(1);
    nextStream.mockClear();
    nextStream.mockResolvedValue({ stream: stream('success') });
    await session.sendMessage({ content: 'Continue successfully' });
    expect(nextStream).toHaveBeenCalled();
    const prompt = nextStream.mock.calls[0]![0].prompt;
    expect(JSON.stringify(prompt)).not.toContain('Provider unavailable');
    expect(JSON.stringify(prompt)).not.toContain('data-session-error');
    expect(prompt.filter(message => message.role === 'assistant').every(message => message.content.length > 0)).toBe(
      true,
    );
    expect(JSON.stringify(prompt)).toContain('Continue successfully');
    expect(JSON.stringify(prompt)).toContain('Remember this earlier context');
    await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
  });

  it.each(['error', 'partial', 'finish'] as const)(
    'persists one %s failure across two real stream subscribers and a fresh session',
    async kind => {
      const { controller, session } = await setup(kind);
      const threadId = session.thread.getId()!;
      const second = await controller.createSession({ resourceId: 'resource', scope: 'second', threadId });
      await second.thread.ensureCurrentSubscription();
      const firstEvents: AgentControllerEvent[] = [];
      const secondEvents: AgentControllerEvent[] = [];
      session.subscribe(event => {
        firstEvents.push(event);
      });
      second.subscribe(event => {
        secondEvents.push(event);
      });
      await session.sendMessage({ content: 'Fail now' });
      await vi.waitFor(() => expect(secondEvents.some(event => event.type === 'agent_end')).toBe(true));
      const firstErrors = firstEvents.filter(event => event.type === 'error');
      const secondErrors = secondEvents.filter(event => event.type === 'error');
      expect(firstErrors).toHaveLength(1);
      expect(secondErrors).toHaveLength(1);
      expect(secondErrors[0]?.occurrenceId).toBe(firstErrors[0]?.occurrenceId);
      expect(firstErrors[0]?.occurrenceId).toEqual(expect.any(String));
      await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
      await controller.deleteSession({ resourceId: 'resource', scope: 'second' });
      const reopened = await controller.createSession({ resourceId: 'resource', scope: 'fresh', threadId });
      const saved = errors(await reopened.thread.listActiveMessages());
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        threadId,
        resourceId: 'resource',
        role: 'assistant',
        createdAt: expect.any(Date),
        content: {
          parts: [
            {
              type: 'data-session-error',
              data: { occurrenceId: firstErrors[0]?.occurrenceId, name: 'Error', message: expect.any(String) },
            },
          ],
        },
      });
      expect(JSON.parse(JSON.stringify(saved[0]?.content.parts))).toEqual(saved[0]?.content.parts);
      await controller.deleteSession({ resourceId: 'resource', scope: 'fresh' });
    },
  );

  it.each(['same', 'away', 'returned', 'replacement'] as const)(
    'records a real failed resume on its originating thread (%s)',
    async switchThread => {
      const { controller, session, agent } = await setup('tool');
      await session.sendMessage({ content: 'Ask for confirmation' });
      const threadId = session.thread.getId()!;
      expect(session.suspensions.get({ toolCallId: 'call-1' })).toBeDefined();
      const failure = Promise.withResolvers<never>();
      const resume = vi.spyOn(agent, 'sendStreamResume').mockImplementationOnce(() => failure.promise);
      const response = session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { approved: true } });
      await vi.waitFor(() => expect(resume).toHaveBeenCalled());
      if (switchThread === 'away' || switchThread === 'returned') await session.thread.create();
      if (switchThread === 'returned') {
        await session.thread.switch({ threadId });
        await vi.waitFor(() => expect(session.suspensions.get({ toolCallId: 'call-1' })).toBeDefined());
      }
      if (switchThread === 'returned' || switchThread === 'replacement') {
        session.run.nextOperation();
        session.run.setRunId({ runId: 'replacement-run' });
        session.run.ensureAbortController();
      }
      const events: AgentControllerEvent[] = [];
      session.subscribe(event => {
        events.push(event);
      });
      failure.reject(new Error('Resume snapshot unavailable'));
      await response;
      if (switchThread !== 'same') {
        expect(events.some(event => event.type === 'error' || event.type === 'agent_end')).toBe(false);
      }
      if (switchThread === 'away') {
        expect(errors(await session.thread.listActiveMessages())).toHaveLength(0);
        await session.thread.switch({ threadId });
      }
      if (switchThread === 'returned' || switchThread === 'replacement') {
        expect(session.run.getRunId()).toBe('replacement-run');
        expect(session.run.isRunning()).toBe(true);
      }
      const saved = errors(await session.thread.listActiveMessages());
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        threadId,
        content: {
          parts: [
            { type: 'data-session-error', data: { message: 'Resume snapshot unavailable', runId: expect.any(String) } },
          ],
        },
      });
      await controller.deleteSession({ resourceId: 'resource', scope: 'first' });
    },
  );
});
