import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerRequestContext } from '../types';

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'response', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text' });
      controller.enqueue({ type: 'text-delta', id: 'text', delta: 'done' });
      controller.enqueue({ type: 'text-end', id: 'text' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

function createToolCallStream(toolCallId: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: toolCallId, modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName: 'captureOwner',
        input: '{}',
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

function createController(storage = new InMemoryStore()) {
  const agent = new Agent({
    id: 'thread-owner-agent',
    name: 'Thread owner agent',
    instructions: 'Answer directly.',
    model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: createTextStream() }) }),
  });
  return {
    storage,
    controller: new AgentController({
      workspace: createMockWorkspace(),
      id: 'thread-owner-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    }),
  };
}

describe('AgentController thread ownership', () => {
  it('stamps ownerId and createdBy on created and cloned threads', async () => {
    const { controller } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });

    const created = await session.thread.getById({ threadId: session.thread.getId()! });
    expect(created?.metadata).toMatchObject({ ownerId: 'owner-a', createdBy: 'owner-a' });

    const cloned = await session.thread.clone();
    expect(cloned.metadata).toMatchObject({ ownerId: 'owner-a', createdBy: 'owner-a' });
  });

  it('uses the session owner as a lazy default without backfilling legacy threads', async () => {
    const { controller, storage } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });
    const threadId = session.thread.getId()!;
    const memory = (await storage.getStore('memory'))!;
    const thread = await memory.getThreadById({ threadId });
    await memory.saveThread({ thread: { ...thread!, metadata: { ...thread!.metadata, ownerId: undefined } } });

    expect(await session.thread.getOwner()).toBe('owner-a');
    expect((await memory.getThreadById({ threadId }))?.metadata?.ownerId).toBeUndefined();
  });

  it('transfers with compare-and-set, emits the change, and preserves createdBy', async () => {
    const { controller } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });
    const threadId = session.thread.getId()!;
    const events: unknown[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await expect(
      session.thread.transferOwnership({ toOwnerId: 'owner-b', expectedOwnerId: 'owner-a' }),
    ).resolves.toEqual({ ok: true });
    await expect(
      session.thread.transferOwnership({ toOwnerId: 'owner-c', expectedOwnerId: 'owner-a' }),
    ).resolves.toEqual({ ok: false, currentOwnerId: 'owner-b' });

    expect(await session.thread.getOwner()).toBe('owner-b');
    expect((await session.thread.getById({ threadId }))?.metadata?.createdBy).toBe('owner-a');
    expect(events).toContainEqual({
      type: 'thread_owner_changed',
      threadId,
      fromOwnerId: 'owner-a',
      toOwnerId: 'owner-b',
    });
  });

  it('allows exactly one concurrent compare-and-set transfer to win', async () => {
    const { controller } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });

    const results = await Promise.all([
      session.thread.transferOwnership({ toOwnerId: 'owner-b', expectedOwnerId: 'owner-a' }),
      session.thread.transferOwnership({ toOwnerId: 'owner-c', expectedOwnerId: 'owner-a' }),
    ]);

    expect(results.filter(result => result.ok)).toHaveLength(1);
    expect(results.filter(result => !result.ok)).toHaveLength(1);
    expect(['owner-b', 'owner-c']).toContain(await session.thread.getOwner());
  });

  it('rejects ownership access through a session for another resource', async () => {
    const { controller } = createController();
    await controller.init();
    const sessionA = await controller.createSession({
      id: 'session-a',
      resourceId: 'resource-a',
      ownerId: 'owner-a',
    });
    const sessionB = await controller.createSession({
      id: 'session-b',
      resourceId: 'resource-b',
      ownerId: 'owner-b',
    });
    const threadA = sessionA.thread.getId()!;

    await expect(sessionB.thread.getOwner({ threadId: threadA })).rejects.toThrow(`Thread not found: ${threadA}`);
    await expect(
      sessionB.thread.transferOwnership({ threadId: threadA, toOwnerId: 'owner-b', expectedOwnerId: 'owner-a' }),
    ).rejects.toThrow(`Thread not found: ${threadA}`);
    await expect(sessionA.thread.getOwner()).resolves.toBe('owner-a');
  });

  it('does not emit or report success when owner persistence fails', async () => {
    const { controller, storage } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });
    const memory = (await storage.getStore('memory'))!;
    const events: unknown[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    vi.spyOn(memory, 'saveThread').mockRejectedValueOnce(new Error('write failed'));

    await expect(
      session.thread.transferOwnership({ toOwnerId: 'owner-b', expectedOwnerId: 'owner-a' }),
    ).rejects.toThrow(`Failed to persist owner for thread: ${session.thread.getId()}`);
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'thread_owner_changed' }));
    await expect(session.thread.getOwner()).resolves.toBe('owner-a');
  });

  it('does not expose owner metadata as session tags', async () => {
    const { controller } = createController();
    await controller.init();
    const session = await controller.createSession({
      id: 'session-a',
      ownerId: 'owner-a',
      tags: { projectPath: '/repo', ownerId: 'spoofed', createdBy: 'spoofed' },
    });

    expect(session.getTags()).toEqual({ projectPath: '/repo' });
  });

  it('snapshots threadOwnerId at run start and exposes a transfer on the next run', async () => {
    let releaseFirstModel!: () => void;
    const firstModelGate = new Promise<void>(resolve => {
      releaseFirstModel = resolve;
    });
    let firstModelStarted!: () => void;
    const firstModelStart = new Promise<void>(resolve => {
      firstModelStarted = resolve;
    });
    const observedOwners: (string | undefined)[] = [];
    const captureOwner = createTool({
      id: 'capture-owner',
      description: 'Capture the thread owner from request context.',
      inputSchema: z.object({}),
      execute: async (_, { requestContext }) => {
        const context = requestContext?.get('controller') as AgentControllerRequestContext | undefined;
        observedOwners.push(context?.threadOwnerId);
        return { ownerId: context?.threadOwnerId };
      },
    });

    let modelCall = 0;
    const agent = new Agent({
      id: 'snapshot-agent',
      name: 'Snapshot agent',
      instructions: 'Always call captureOwner.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => {
          modelCall += 1;
          if (modelCall === 1) {
            firstModelStarted();
            await firstModelGate;
            return { stream: createToolCallStream('owner-call-1') };
          }
          if (modelCall === 3) return { stream: createToolCallStream('owner-call-2') };
          return { stream: createTextStream() };
        },
      }),
      tools: { captureOwner },
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'snapshot-agent': agent }, storage, logger: false });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'snapshot-controller',
      storage,
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent('snapshot-agent') }],
    });
    await controller.init();
    const session = await controller.createSession({ id: 'session-a', ownerId: 'owner-a' });

    const firstRun = session.sendMessage({ content: 'Capture owner' });
    await firstModelStart;
    await session.thread.transferOwnership({ toOwnerId: 'owner-b', expectedOwnerId: 'owner-a' });
    releaseFirstModel();
    await firstRun;
    await session.sendMessage({ content: 'Capture owner again' });

    expect(observedOwners).toEqual(['owner-a', 'owner-b']);
  });
});
