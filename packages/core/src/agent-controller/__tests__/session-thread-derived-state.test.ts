import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { LeasePubSub } from '../../agent/__tests__/thread-stream-test-utils';
import { createDurableAgent, globalRunRegistry } from '../../agent/durable';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { InMemoryServerCache } from '../../cache';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { askUserTool } from '../../tools/builtin/ask-user';
import { AgentController } from '../agent-controller';
import { SessionSuspensions } from '../session';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

function createUsageStream(usage: { inputTokens: number; outputTokens: number; totalTokens: number }) {
  async function* stream() {
    yield {
      type: 'step-finish',
      runId: 'usage-run',
      from: 'AGENT',
      payload: { output: { usage }, stepResult: { reason: 'stop' }, metadata: {} },
    };
    yield {
      type: 'finish',
      runId: 'usage-run',
      from: 'AGENT',
      payload: { output: { usage }, stepResult: { reason: 'stop' }, metadata: {} },
    };
  }
  return stream();
}

function createAskUserStream(input: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'ask_user',
        input,
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

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Thanks!' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function createSettingsController(
  storage: InMemoryStore,
  id: string,
  threadLock?: { acquire(threadId: string): Promise<void>; release(threadId: string): Promise<void> },
) {
  const agent = new Agent({
    id: `settings-agent-${id}`,
    name: `Settings agent ${id}`,
    instructions: 'Test thread settings.',
    model: new MastraLanguageModelV2Mock({}),
  });
  const controller = new AgentController<any>({
    workspace: createMockWorkspace(),
    id: `settings-controller-${id}`,
    storage,
    threadLock,
    initialState: { thinkingLevel: 'low', yolo: true },
    modes: [
      { id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-5.5', agent },
      { id: 'plan', name: 'Plan', defaultModelId: 'openai/gpt-5.2-codex', agent },
    ],
  });
  await controller.init();
  return controller;
}

async function createDurableFixture() {
  const storage = new InMemoryStore();
  const cache = new InMemoryServerCache();
  const memory = new MockMemory({ storage });
  let pubsub = new LeasePubSub();
  pubsub.retain = true;
  let modelCalls = 0;

  const createController = async () => {
    const baseAgent = new Agent({
      id: 'durable-agent',
      name: 'Durable agent',
      instructions: 'Ask a question, then acknowledge the answer.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({
          stream:
            ++modelCalls === 1
              ? createAskUserStream(JSON.stringify({ question: 'Which environment?' }))
              : createTextStream(),
        }),
      }),
      tools: { ask_user: askUserTool },
      memory,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, cache, pubsub });
    const mastra = new Mastra({ agents: { agent: durableAgent }, storage, cache, pubsub, logger: false });
    const controller = new AgentController({
      id: 'durable-controller',
      agent: mastra.getAgent('agent'),
      pubsub,
      workspace: createMockWorkspace(),
      storage,
      initialState: { yolo: false } as any,
      modes: [{ id: 'default', name: 'Default', default: true }],
    });
    await controller.init();
    return controller;
  };

  return {
    createController,
    restartRuntime() {
      pubsub = pubsub.restart();
      agentThreadStreamRuntime.resetForTests();
      globalRunRegistry.clear();
    },
    getModelCalls: () => modelCalls,
  };
}

describe('AgentController thread-derived session state', () => {
  it('restores mode, model, thinking level, and token usage when switching A to B to A', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'switch');
    const session = await controller.createSession({
      id: 'switch-session',
      resourceId: 'shared-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });

    const threadA = await session.thread.create({ id: 'thread-a' });
    await session.mode.switch({ modeId: 'plan' });
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    await session.state.set({ thinkingLevel: 'high' });
    await (session as any).processStream({
      fullStream: createUsageStream({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    });

    const threadB = await session.thread.create({ id: 'thread-b' });
    await session.model.switch({ modelId: 'openai/gpt-5.4' });
    await session.state.set({ thinkingLevel: 'medium' });
    await (session as any).processStream({
      fullStream: createUsageStream({ inputTokens: 40, outputTokens: 50, totalTokens: 90 }),
    });

    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('openai/gpt-5.4');
    expect(session.state.get().thinkingLevel).toBe('medium');
    expect(session.getTokenUsage()).toMatchObject({ promptTokens: 40, completionTokens: 50, totalTokens: 90 });

    await session.thread.switch({ threadId: threadA.id });
    expect(session.mode.get()).toBe('plan');
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(session.state.get().thinkingLevel).toBe('high');
    expect(session.getTokenUsage()).toMatchObject({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });

    await session.thread.switch({ threadId: threadB.id });
    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('openai/gpt-5.4');
    expect(session.state.get().thinkingLevel).toBe('medium');
    expect(session.getTokenUsage()).toMatchObject({ promptTokens: 40, completionTokens: 50, totalTokens: 90 });
  });

  it('does not promote a thread model to the host default when none is configured', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'no-default-model-agent',
      name: 'No default model agent',
      instructions: 'Test model isolation.',
      model: new MastraLanguageModelV2Mock({}),
    });
    const controller = new AgentController({
      id: 'no-default-model-controller',
      agent,
      workspace: createMockWorkspace(),
      storage,
      modes: [{ id: 'default', name: 'Default', default: true }],
    });
    await controller.init();
    const session = await controller.createSession({
      id: 'no-default-model-session',
      resourceId: 'no-default-model-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });

    const metadataLessThread = await session.thread.create({ id: 'metadata-less-thread' });
    const configuredThread = await session.thread.create({ id: 'configured-thread' });
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    await session.thread.create({ id: 'new-thread' });
    expect(session.model.get()).toBe('');

    await session.thread.switch({ threadId: configuredThread.id });
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');

    await session.thread.switch({ threadId: metadataLessThread.id });
    expect(session.model.get()).toBe('');
  });

  it('hydrates the same thread settings in sessions with different scopes', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'scopes');
    const first = await controller.createSession({
      id: 'first-session',
      resourceId: 'shared-resource',
      scope: 'scope-a',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const thread = await first.thread.create({ id: 'shared-thread' });
    await first.mode.switch({ modeId: 'plan' });
    await first.model.switch({ modelId: 'anthropic/claude-sonnet-4-5' });
    await first.state.set({ thinkingLevel: 'high' });
    await (first as any).processStream({
      fullStream: createUsageStream({ inputTokens: 5, outputTokens: 8, totalTokens: 13 }),
    });

    const second = await controller.createSession({
      id: 'second-session',
      resourceId: 'shared-resource',
      scope: 'scope-b',
      ownerId: 'owner',
      threadId: thread.id,
    });

    expect(second).not.toBe(first);
    expect(second.mode.get()).toBe('plan');
    expect(second.model.get()).toBe('anthropic/claude-sonnet-4-5');
    expect(second.state.get().thinkingLevel).toBe('high');
    expect(second.getTokenUsage()).toMatchObject({ promptTokens: 5, completionTokens: 8, totalTokens: 13 });
  });

  it('preserves the live thread projection when a metadata refresh fails', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'metadata-refresh-failure');
    const session = await controller.createSession({
      id: 'metadata-refresh-session',
      resourceId: 'metadata-refresh-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    await session.thread.create({ id: 'metadata-refresh-thread' });
    await session.mode.switch({ modeId: 'plan' });
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    await session.state.set({ thinkingLevel: 'high' });

    const memory = await storage.getStore('memory');
    vi.spyOn(memory!, 'getThreadById').mockRejectedValueOnce(new Error('transient metadata read failure'));

    await session.thread.loadMetadata();

    expect(session.mode.get()).toBe('plan');
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(session.state.get().thinkingLevel).toBe('high');
  });

  it('does not leak token usage when the target thread metadata read fails', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'usage-read-failure');
    const session = await controller.createSession({
      id: 'usage-session',
      resourceId: 'usage-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'usage-thread-a' });
    await (session as any).processStream({
      fullStream: createUsageStream({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
    });
    await session.thread.create({ id: 'usage-thread-b' });
    await (session as any).processStream({
      fullStream: createUsageStream({ inputTokens: 40, outputTokens: 50, totalTokens: 90 }),
    });

    const memory = await storage.getStore('memory');
    const getThreadById = memory!.getThreadById.bind(memory);
    let reads = 0;
    vi.spyOn(memory!, 'getThreadById').mockImplementation(async args => {
      reads++;
      if (reads === 2) throw new Error('transient metadata read failure');
      return getThreadById(args);
    });

    await session.thread.switch({ threadId: threadA.id });
    expect(session.getTokenUsage()).toMatchObject({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('fences a queued thread preference update from a newly created thread', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'queued-preference');
    const session = await controller.createSession({
      id: 'queued-session',
      resourceId: 'queued-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'queued-thread-a' });

    let releaseBlock!: () => void;
    let markBlockStarted!: () => void;
    const block = new Promise<void>(resolve => {
      releaseBlock = resolve;
    });
    const blockStarted = new Promise<void>(resolve => {
      markBlockStarted = resolve;
    });
    const blocker = session.state.update(async () => {
      markBlockStarted();
      await block;
      return { updates: {}, result: undefined };
    });
    await blockStarted;
    const pending = session.state.set({ thinkingLevel: 'high' });

    const threadB = await session.thread.create({ id: 'queued-thread-b' });
    expect(session.state.get().thinkingLevel).toBe('low');
    releaseBlock();
    await blocker;
    await pending;
    expect(session.state.get().thinkingLevel).toBe('low');

    const memory = await storage.getStore('memory');
    expect((await memory?.getThreadById({ threadId: threadA.id }))?.metadata?.thinkingLevel).toBe('high');
    expect((await memory?.getThreadById({ threadId: threadB.id }))?.metadata?.thinkingLevel).toBeUndefined();
  });

  it('keeps writes during thread creation on the previous thread', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'create-race');
    const session = await controller.createSession({
      id: 'create-race-session',
      resourceId: 'create-race-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'create-race-a' });
    const memory = await storage.getStore('memory');
    const saveThread = memory!.saveThread.bind(memory);
    let releaseSave!: () => void;
    let markSaveStarted!: () => void;
    const saveBlocked = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    const saveStarted = new Promise<void>(resolve => {
      markSaveStarted = resolve;
    });
    vi.spyOn(memory!, 'saveThread').mockImplementation(async args => {
      if (args.thread.id === 'create-race-b') {
        markSaveStarted();
        await saveBlocked;
      }
      return saveThread(args);
    });

    const creating = session.thread.create({ id: 'create-race-b' });
    await saveStarted;
    await session.state.set({ thinkingLevel: 'high' });
    releaseSave();
    const threadB = await creating;

    expect(session.thread.getId()).toBe(threadB.id);
    expect(session.state.get().thinkingLevel).toBe('low');
    expect((await memory!.getThreadById({ threadId: threadA.id }))?.metadata?.thinkingLevel).toBe('high');
    expect((await memory!.getThreadById({ threadId: threadB.id }))?.metadata?.thinkingLevel).toBeUndefined();
  });

  it('preserves the previous binding and state when thread creation fails', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'create-failure');
    const session = await controller.createSession({
      id: 'create-failure-session',
      resourceId: 'create-failure-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'create-failure-a' });
    await session.state.set({ thinkingLevel: 'high' });
    const cleanupSubscription = vi.spyOn(session.thread, 'cleanupSubscription');
    const memory = await storage.getStore('memory');
    const saveThread = memory!.saveThread.bind(memory);
    vi.spyOn(memory!, 'saveThread').mockImplementation(args => {
      if (args.thread.id === 'create-failure-b') return Promise.reject(new Error('save failed'));
      return saveThread(args);
    });

    await expect(session.thread.create({ id: 'create-failure-b' })).rejects.toThrow('save failed');
    expect(cleanupSubscription).not.toHaveBeenCalled();
    expect(session.thread.getId()).toBe(threadA.id);
    expect(session.state.get().thinkingLevel).toBe('high');
  });

  it('keeps the current subscription when a switch is rejected', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'switch-failure');
    const session = await controller.createSession({
      id: 'switch-failure-session',
      resourceId: 'switch-failure-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const thread = await session.thread.create({ id: 'switch-failure-current' });
    const cleanupSubscription = vi.spyOn(session.thread, 'cleanupSubscription');

    await expect(session.thread.switch({ threadId: 'missing-thread' })).rejects.toThrow(
      'Thread not found: missing-thread',
    );
    expect(cleanupSubscription).not.toHaveBeenCalled();
    expect(session.thread.getId()).toBe(thread.id);
  });

  it('does not tear down the current subscription when a stale restore is rejected', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'stale-subscription-restore');
    const session = await controller.createSession({
      id: 'stale-subscription-restore-session',
      resourceId: 'stale-subscription-restore-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    await session.thread.create({ id: 'current-thread' });
    const cleanupSubscription = vi.spyOn(session.thread, 'cleanupSubscription');

    await session.thread.ensureSubscription('stale-thread', undefined, undefined, 'stale-resource', () => false);

    expect(cleanupSubscription).not.toHaveBeenCalled();
    expect(session.thread.getId()).toBe('current-thread');
  });

  it('serializes metadata hydration across concurrent switches', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'switch-race');
    const session = await controller.createSession({
      id: 'switch-race-session',
      resourceId: 'switch-race-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'switch-race-a' });
    await session.mode.switch({ modeId: 'plan' });
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    await session.state.set({ thinkingLevel: 'high' });
    const threadB = await session.thread.create({ id: 'switch-race-b' });
    await session.model.switch({ modelId: 'openai/gpt-5.4' });
    await session.state.set({ thinkingLevel: 'medium' });

    const memory = await storage.getStore('memory');
    const getThreadById = memory!.getThreadById.bind(memory);
    let readsOfA = 0;
    let releaseA!: () => void;
    let markAStarted!: () => void;
    const aBlocked = new Promise<void>(resolve => {
      releaseA = resolve;
    });
    const aStarted = new Promise<void>(resolve => {
      markAStarted = resolve;
    });
    vi.spyOn(memory!, 'getThreadById').mockImplementation(async args => {
      if (args.threadId === threadA.id && ++readsOfA === 2) {
        markAStarted();
        await aBlocked;
      }
      return getThreadById(args);
    });

    const switchToA = session.thread.switch({ threadId: threadA.id });
    await aStarted;
    const switchToB = session.thread.switch({ threadId: threadB.id });
    releaseA();
    await Promise.all([switchToA, switchToB]);

    expect(session.thread.getId()).toBe(threadB.id);
    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('openai/gpt-5.4');
    expect(session.state.get().thinkingLevel).toBe('medium');
  });

  it('clears thread-derived state when deleting the active thread', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'delete-active');
    const session = await controller.createSession({
      id: 'delete-active-session',
      resourceId: 'delete-active-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const thread = await session.thread.create({ id: 'delete-active-thread' });
    await session.mode.switch({ modeId: 'plan' });
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    await session.state.set({ thinkingLevel: 'high' });

    await session.thread.delete({ threadId: thread.id });

    expect(session.thread.getId()).toBeNull();
    expect(session.mode.get()).toBe('build');
    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get().thinkingLevel).toBe('low');
  });

  it('serializes deletion with a concurrent switch', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'delete-race');
    const session = await controller.createSession({
      id: 'delete-race-session',
      resourceId: 'delete-race-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'delete-race-a' });
    const threadB = await session.thread.create({ id: 'delete-race-b' });
    await session.thread.switch({ threadId: threadA.id });

    const memory = await storage.getStore('memory');
    const deleteThread = memory!.deleteThread.bind(memory);
    let releaseDelete!: () => void;
    let markDeleteStarted!: () => void;
    const deleteBlocked = new Promise<void>(resolve => {
      releaseDelete = resolve;
    });
    const deleteStarted = new Promise<void>(resolve => {
      markDeleteStarted = resolve;
    });
    vi.spyOn(memory!, 'deleteThread').mockImplementation(async args => {
      if (args.threadId === threadA.id) {
        markDeleteStarted();
        await deleteBlocked;
      }
      return deleteThread(args);
    });

    const deleting = session.thread.delete({ threadId: threadA.id });
    await deleteStarted;
    const switching = session.thread.switch({ threadId: threadB.id });
    releaseDelete();
    await Promise.all([deleting, switching]);

    expect(session.thread.getId()).toBe(threadB.id);
  });

  it('orders ensureId around intervening switch and delete operations', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'ensure-switch-race');
    const source = await controller.createSession({
      id: 'ensure-switch-source',
      resourceId: 'ensure-switch-resource',
      scope: 'source',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const target = await source.thread.create({ id: 'ensure-switch-target' });
    const session = await controller.createSession({
      id: 'ensure-switch-session',
      resourceId: 'ensure-switch-resource',
      scope: 'target',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const memory = await storage.getStore('memory');
    const getThreadById = memory!.getThreadById.bind(memory);
    let releaseRead!: () => void;
    let markReadStarted!: () => void;
    const readBlocked = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    const readStarted = new Promise<void>(resolve => {
      markReadStarted = resolve;
    });
    let blocked = false;
    vi.spyOn(memory!, 'getThreadById').mockImplementation(async args => {
      if (args.threadId === target.id && !blocked) {
        blocked = true;
        markReadStarted();
        await readBlocked;
      }
      return getThreadById(args);
    });

    const switching = session.thread.switch({ threadId: target.id });
    await readStarted;
    expect(() => session.thread.set({ threadId: 'bypass' })).toThrow(
      'Cannot set the active thread during a thread lifecycle transition',
    );
    expect(() => session.thread.clear()).toThrow('Cannot clear the active thread during a thread lifecycle transition');
    const ensuredBeforeDelete = session.thread.ensureId();
    const deleting = session.thread.delete({ threadId: target.id });
    const ensuredAfterDelete = session.thread.ensureId();
    releaseRead();

    await switching;
    expect(await ensuredBeforeDelete).toBe(target.id);
    await deleting;
    const replacementId = await ensuredAfterDelete;
    expect(replacementId).not.toBe(target.id);
    expect(session.thread.getId()).toBe(replacementId);
  });

  it('serializes session deletion behind an in-flight thread creation', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'session-delete-race');
    const session = await controller.createSession({
      id: 'session-delete-race-session',
      resourceId: 'session-delete-race-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    await session.thread.create({ id: 'session-delete-race-a' });
    const memory = await storage.getStore('memory');
    const saveThread = memory!.saveThread.bind(memory);
    let releaseSave!: () => void;
    let markSaveStarted!: () => void;
    const saveBlocked = new Promise<void>(resolve => {
      releaseSave = resolve;
    });
    const saveStarted = new Promise<void>(resolve => {
      markSaveStarted = resolve;
    });
    vi.spyOn(memory!, 'saveThread').mockImplementation(async args => {
      if (args.thread.id === 'session-delete-race-b') {
        markSaveStarted();
        await saveBlocked;
      }
      return saveThread(args);
    });

    const creating = session.thread.create({ id: 'session-delete-race-b' });
    await saveStarted;
    const deleting = controller.deleteSession({ resourceId: 'session-delete-race-resource' });
    releaseSave();
    await Promise.all([creating, deleting]);

    expect(session.thread.getId()).toBeNull();
    await expect(controller.getSessionByResource('session-delete-race-resource')).resolves.toBeUndefined();
  });

  it('serializes a resource change behind an in-flight switch', async () => {
    const storage = new InMemoryStore();
    const controller = await createSettingsController(storage, 'resource-switch-race');
    const session = await controller.createSession({
      id: 'resource-switch-race-session',
      resourceId: 'resource-switch-race-old',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const threadA = await session.thread.create({ id: 'resource-switch-race-a' });
    await session.thread.create({ id: 'resource-switch-race-b' });
    const memory = await storage.getStore('memory');
    const getThreadById = memory!.getThreadById.bind(memory);
    let readsOfA = 0;
    let releaseA!: () => void;
    let markAStarted!: () => void;
    const aBlocked = new Promise<void>(resolve => {
      releaseA = resolve;
    });
    const aStarted = new Promise<void>(resolve => {
      markAStarted = resolve;
    });
    vi.spyOn(memory!, 'getThreadById').mockImplementation(async args => {
      if (args.threadId === threadA.id && ++readsOfA === 2) {
        markAStarted();
        await aBlocked;
      }
      return getThreadById(args);
    });

    const switching = session.thread.switch({ threadId: threadA.id });
    await aStarted;
    const changingResource = controller.setResourceId(session, { resourceId: 'resource-switch-race-new' });
    releaseA();
    await Promise.all([switching, changingResource]);

    expect(session.identity.getResourceId()).toBe('resource-switch-race-new');
    expect(session.thread.getId()).toBeNull();
  });

  it('re-keys the session when releasing the previous thread lock fails', async () => {
    const storage = new InMemoryStore();
    const threadLock = {
      acquire: vi.fn(async () => {}),
      release: vi.fn(async () => {
        throw new Error('release failed');
      }),
    };
    const controller = await createSettingsController(storage, 'resource-release-failure', threadLock);
    const session = await controller.createSession({
      id: 'resource-release-failure-session',
      resourceId: 'resource-release-failure-old',
      ownerId: 'owner',
      createInitialThread: false,
    });
    await session.thread.create({ id: 'resource-release-failure-thread' });

    await controller.setResourceId(session, { resourceId: 'resource-release-failure-new' });

    expect(session.identity.getResourceId()).toBe('resource-release-failure-new');
    expect(session.thread.getId()).toBeNull();
    await expect(controller.getSessionByResource('resource-release-failure-old')).resolves.toBeUndefined();
    await expect(controller.getSessionByResource('resource-release-failure-new')).resolves.toBe(session);
    expect(threadLock.release).toHaveBeenCalledWith('resource-release-failure-thread');
  });

  it('scopes suspension cleanup by resource and thread and exposes none without an active thread', () => {
    let activeResourceId = 'resource';
    let activeThreadId: string | null = 'thread-a';
    const suspensions = new SessionSuspensions(() => ({ resourceId: activeResourceId, threadId: activeThreadId }));
    suspensions.register({
      toolCallId: 'call-a',
      runId: 'shared-run',
      toolName: 'ask_user',
      threadId: 'thread-a',
      resourceId: 'resource',
    });
    suspensions.register({
      toolCallId: 'call-b',
      runId: 'shared-run',
      toolName: 'ask_user',
      threadId: 'thread-b',
      resourceId: 'resource',
    });
    suspensions.register({
      toolCallId: 'call-other-resource',
      runId: 'shared-run',
      toolName: 'ask_user',
      threadId: 'thread-a',
      resourceId: 'other-resource',
    });

    expect(suspensions.deleteForRun({ resourceId: 'resource', threadId: 'thread-a', runId: 'shared-run' })).toEqual([
      {
        resourceId: 'resource',
        threadId: 'thread-a',
        runId: 'shared-run',
        toolCallId: 'call-a',
        toolName: 'ask_user',
      },
    ]);
    expect(
      suspensions.has({
        resourceId: 'other-resource',
        threadId: 'thread-a',
        runId: 'shared-run',
        toolCallId: 'call-other-resource',
      }),
    ).toBe(true);
    activeThreadId = 'thread-b';
    expect(suspensions.hasPending()).toBe(true);
    activeThreadId = null;
    expect(suspensions.hasPending()).toBe(false);
    expect(suspensions.resolveToolCallId()).toBeUndefined();
    suspensions.deleteForThread({ threadId: 'thread-b' });
    activeThreadId = 'thread-b';
    expect(suspensions.hasPending()).toBe(false);
  });

  it('hides another thread suspension, then resumes it after switching back', async () => {
    const fixture = await createDurableFixture();
    const controller = await fixture.createController();
    const session = await controller.createSession({ id: 'session', resourceId: 'resource', ownerId: 'owner' });
    const threadA = await session.thread.create({ id: 'thread-a' });
    await session.permissions.setForTool({ toolName: 'ask_user', policy: 'allow' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    await session.sendMessage({ content: 'Ask me a question.' });
    await vi.waitFor(() =>
      expect(
        [...session.displayState.get().pendingSuspensions.values()].some(
          suspension => suspension.toolCallId === 'call-1',
        ),
      ).toBe(true),
    );

    await session.thread.create({ id: 'thread-b' });
    expect(session.suspensions.hasPending()).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);

    await session.thread.switch({ threadId: threadA.id });
    await vi.waitFor(() =>
      expect(
        [...session.displayState.get().pendingSuspensions.values()].some(
          suspension => suspension.toolCallId === 'call-1',
        ),
      ).toBe(true),
    );
    expect(session.claimToolSuspension('call-1')).toMatchObject({ accepted: true, toolCallId: 'call-1' });
    await session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: 'Production' });
    await vi.waitFor(() => expect(fixture.getModelCalls()).toBe(2));
    expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('recovers thread settings and a pending suspension in a new session after restart', async () => {
    const storage = new InMemoryStore();
    const settingsController = await createSettingsController(storage, 'restart-settings');
    const settingsSession = await settingsController.createSession({
      id: 'old-settings-session',
      resourceId: 'settings-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const settingsThread = await settingsSession.thread.create({ id: 'settings-thread' });
    await settingsSession.mode.switch({ modeId: 'plan' });
    await settingsSession.model.switch({ modelId: 'anthropic/claude-opus-4-6' });
    await settingsSession.state.set({ thinkingLevel: 'high' });

    const restartedSettingsController = await createSettingsController(storage, 'restart-settings-new');
    const restartedSettingsSession = await restartedSettingsController.createSession({
      id: 'new-settings-session',
      resourceId: 'settings-resource',
      ownerId: 'owner',
      threadId: settingsThread.id,
    });
    expect(restartedSettingsSession.mode.get()).toBe('plan');
    expect(restartedSettingsSession.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(restartedSettingsSession.state.get().thinkingLevel).toBe('high');

    const fixture = await createDurableFixture();
    const firstController = await fixture.createController();
    const firstSession = await firstController.createSession({
      id: 'old-session',
      resourceId: 'durable-resource',
      ownerId: 'owner',
    });
    const durableThread = await firstSession.thread.create({ id: 'durable-thread' });
    await firstSession.permissions.setForTool({ toolName: 'ask_user', policy: 'allow' });
    await firstSession.sendMessage({ content: 'Ask me a question.' });
    await vi.waitFor(() =>
      expect(
        [...firstSession.displayState.get().pendingSuspensions.values()].some(
          suspension => suspension.toolCallId === 'call-1',
        ),
      ).toBe(true),
    );
    await firstSession.thread.detachFromCurrent();

    fixture.restartRuntime();
    const secondController = await fixture.createController();
    const secondSession = await secondController.createSession({
      id: 'new-session',
      resourceId: 'durable-resource',
      ownerId: 'owner',
      createInitialThread: false,
    });
    const events: AgentControllerEvent[] = [];
    secondSession.subscribe(event => {
      events.push(event);
    });
    await secondSession.thread.switch({ threadId: durableThread.id });

    await vi.waitFor(() =>
      expect(
        [...secondSession.displayState.get().pendingSuspensions.values()].some(
          suspension => suspension.toolCallId === 'call-1',
        ),
      ).toBe(true),
    );
    expect(fixture.getModelCalls()).toBe(1);
    await secondSession.respondToToolSuspension({ toolCallId: 'call-1', resumeData: 'Staging' });
    await vi.waitFor(() => expect(fixture.getModelCalls()).toBe(2));
    expect(events.some(event => event.type === 'error')).toBe(false);
  });
});
