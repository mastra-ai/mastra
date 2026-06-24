import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { HarnessEvent } from './types';

function createHarness(
  storage: InMemoryStore,
  options: { resourceId?: string; initialState?: Record<string, unknown> } = {},
) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new Harness({
    id: 'test-harness',
    resourceId: options.resourceId,
    storage,
    initialState: options.initialState,
    modes: [
      { id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' },
      { id: 'plan', name: 'Plan', agent, defaultModelId: 'anthropic/claude-sonnet-4' },
    ],
  });
}

describe('Harness.createSession — cross-session isolation', () => {
  it('gives each session an independent current thread', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    expect(a.thread.getId()).toBeDefined();
    expect(b.thread.getId()).toBeDefined();
    expect(a.thread.getId()).not.toBe(b.thread.getId());
  });

  it('isolates mode switches between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    expect(a.mode.get()).toBe('build');
    expect(b.mode.get()).toBe('build');

    await a.mode.switch({ modeId: 'plan' });

    // Only session a moved to plan; b is untouched.
    expect(a.mode.get()).toBe('plan');
    expect(b.mode.get()).toBe('build');
  });

  it('isolates model selection between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    await a.model.switch({ modelId: 'cerebras/zai-glm-4.7' });

    expect(a.model.get()).toBe('cerebras/zai-glm-4.7');
    // b still resolves its mode default, unaffected by a's override.
    expect(b.model.get()).toBe('openai/gpt-4o');
  });

  it('isolates session state between sessions', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    });
    const harness = new Harness<{ counter: number }>({
      id: 'test-harness',
      storage,
      initialState: { counter: 0 },
      modes: [{ id: 'build', name: 'Build', default: true, agent }],
    });
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    await a.state.set({ counter: 5 });

    expect(a.state.get().counter).toBe(5);
    expect(b.state.get().counter).toBe(0);
  });

  it('isolates event buses between sessions', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aEvents: HarnessEvent[] = [];
    const bEvents: HarnessEvent[] = [];
    a.subscribe(event => {
      aEvents.push(event);
    });
    b.subscribe(event => {
      bEvents.push(event);
    });

    await a.mode.switch({ modeId: 'plan' });

    expect(aEvents.some(e => e.type === 'mode_changed')).toBe(true);
    expect(bEvents.some(e => e.type === 'mode_changed')).toBe(false);
  });

  it('does not auto-claim a matching projectPath thread from another resource', async () => {
    const storage = new InMemoryStore();
    const projectPath = '/tmp/mastra-project';

    const oldHarness = createHarness(storage, { resourceId: 'old-resource', initialState: { projectPath } });
    await oldHarness.init();
    const oldSession = await oldHarness.createSession();
    const oldThreadId = oldSession.thread.requireId();

    const currentHarness = createHarness(storage, { resourceId: 'current-resource', initialState: { projectPath } });
    await currentHarness.init();
    const currentSession = await currentHarness.createSession();

    expect(currentSession.thread.requireId()).not.toBe(oldThreadId);
    await expect(currentSession.thread.switch({ threadId: oldThreadId })).rejects.toThrow(
      `Thread not found: ${oldThreadId}`,
    );
    expect(await storage.stores.memory.getThreadById({ threadId: oldThreadId })).toMatchObject({
      id: oldThreadId,
      resourceId: 'old-resource',
    });
  });

  it('resumes the matching projectPath thread from the same resource', async () => {
    const storage = new InMemoryStore();
    const projectPath = '/tmp/mastra-project';
    const harness = createHarness(storage, { resourceId: 'current-resource', initialState: { projectPath } });
    await harness.init();

    const first = await harness.createSession();
    const threadId = first.thread.requireId();

    const restartedHarness = createHarness(storage, { resourceId: 'current-resource', initialState: { projectPath } });
    await restartedHarness.init();
    const restarted = await restartedHarness.createSession();

    expect(restarted.thread.requireId()).toBe(threadId);
  });
});

describe('Harness session — cross-resource thread ownership', () => {
  it('cannot switch to a thread owned by another resource', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();
    const bThreadBefore = b.thread.getId();

    await expect(b.thread.switch({ threadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
    // b stays bound to its own thread; it never moved onto a's.
    expect(b.thread.getId()).toBe(bThreadBefore);

    // The failed switch released its lock on b's thread before validating
    // ownership; b must still own (and be able to re-bind) its own thread,
    // proving the previous lock was restored on the failure path.
    await expect(b.thread.switch({ threadId: bThreadBefore! })).resolves.toBeUndefined();
    expect(b.thread.getId()).toBe(bThreadBefore);
  });

  it('cannot delete a thread owned by another resource', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.delete({ threadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
    // a's thread still exists and is reachable by its owner.
    expect(await a.thread.getById({ threadId: aThreadId })).not.toBeNull();
  });

  it('cannot list messages of a thread owned by another resource', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.listMessages({ threadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
  });

  it('cannot clone a thread owned by another resource', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.clone({ sourceThreadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
  });

  it('only migrates a cross-resource thread when the detected resource and project path still match', async () => {
    const storage = new InMemoryStore();
    const projectPath = '/tmp/mastra-project';
    const oldHarness = createHarness(storage, { resourceId: 'old-resource', initialState: { projectPath } });
    await oldHarness.init();
    const oldSession = await oldHarness.createSession();
    const oldThreadId = oldSession.thread.requireId();

    const currentHarness = createHarness(storage, { resourceId: 'current-resource', initialState: { projectPath } });
    await currentHarness.init();
    const currentSession = await currentHarness.createSession();

    await expect(
      currentSession.thread.migrateToCurrentResource({
        threadId: oldThreadId,
        expectedResourceId: 'another-resource',
        expectedProjectPath: projectPath,
      }),
    ).rejects.toThrow(`Thread not found: ${oldThreadId}`);

    await expect(
      currentSession.thread.migrateToCurrentResource({
        threadId: oldThreadId,
        expectedResourceId: 'old-resource',
        expectedProjectPath: '/tmp/other-project',
      }),
    ).rejects.toThrow(`Thread not found: ${oldThreadId}`);

    await expect(
      currentSession.thread.migrateToCurrentResource({
        threadId: oldThreadId,
        expectedResourceId: 'old-resource',
        expectedProjectPath: projectPath,
      }),
    ).resolves.toBeUndefined();

    expect(await storage.stores.memory.getThreadById({ threadId: oldThreadId })).toMatchObject({
      id: oldThreadId,
      resourceId: 'current-resource',
    });
  });

  it('still allows the owning resource to switch, list, and delete its own thread', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const aThreadId = a.thread.requireId();

    // Owner can read its own messages and switch to its own thread.
    await expect(a.thread.listMessages({ threadId: aThreadId })).resolves.toEqual([]);
    await expect(a.thread.switch({ threadId: aThreadId })).resolves.toBeUndefined();

    // Owner can delete its own thread.
    await expect(a.thread.delete({ threadId: aThreadId })).resolves.toBeUndefined();
    expect(await a.thread.getById({ threadId: aThreadId })).toBeNull();
  });
});

describe('Harness session registry', () => {
  it('resolves a created session by its resourceId', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    const b = await harness.createSession({ resourceId: 'user-b' });

    expect(await harness.getSessionByResource('user-a')).toBe(a);
    expect(await harness.getSessionByResource('user-b')).toBe(b);
    expect(await harness.getSessionByResource('user-unknown')).toBeUndefined();
  });

  it('returns the same session for the same resourceId (get-or-create)', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const first = await harness.createSession({ resourceId: 'user-a' });
    const second = await harness.createSession({ resourceId: 'user-a' });

    expect(second).toBe(first);
  });

  it('follows a session when its resourceId changes', async () => {
    const harness = createHarness(new InMemoryStore());
    await harness.init();

    const a = await harness.createSession({ resourceId: 'user-a' });
    harness.setResourceId(a, { resourceId: 'user-a-renamed' });

    expect(await harness.getSessionByResource('user-a-renamed')).toBe(a);
    expect(await harness.getSessionByResource('user-a')).toBeUndefined();
  });
});
