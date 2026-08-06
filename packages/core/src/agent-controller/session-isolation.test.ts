import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function createController(
  storage: InMemoryStore,
  options: { resourceId?: string; initialState?: Record<string, unknown> } = {},
) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    resourceId: options.resourceId,
    storage,
    initialState: options.initialState,
    modes: [
      { id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' },
      { id: 'plan', name: 'Plan', agent, defaultModelId: 'anthropic/claude-sonnet-4' },
    ],
  });
}

describe('AgentController.createSession — cross-session isolation', () => {
  it('gives each session an independent current thread', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

    expect(a.thread.getId()).toBeDefined();
    expect(b.thread.getId()).toBeDefined();
    expect(a.thread.getId()).not.toBe(b.thread.getId());
  });

  it('isolates mode switches between sessions', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

    expect(a.mode.get()).toBe('build');
    expect(b.mode.get()).toBe('build');

    await a.mode.switch({ modeId: 'plan' });

    // Only session a moved to plan; b is untouched.
    expect(a.mode.get()).toBe('plan');
    expect(b.mode.get()).toBe('build');
  });

  it('isolates model selection between sessions', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

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
    const controller = new AgentController<{ counter: number }>({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      initialState: { counter: 0 },
      modes: [{ id: 'build', name: 'Build', default: true, agent }],
    });
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

    await a.state.set({ counter: 5 });

    expect(a.state.get().counter).toBe(5);
    expect(b.state.get().counter).toBe(0);
  });

  it('isolates event buses between sessions', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

    const aEvents: AgentControllerEvent[] = [];
    const bEvents: AgentControllerEvent[] = [];
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

    const oldController = createController(storage, { resourceId: 'old-resource', initialState: { projectPath } });
    await oldController.init();
    const oldSession = await oldController.createSession();
    const oldThreadId = oldSession.thread.requireId();

    const currentController = createController(storage, {
      resourceId: 'current-resource',
      initialState: { projectPath },
    });
    await currentController.init();
    const currentSession = await currentController.createSession();

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
    const controller = createController(storage, { resourceId: 'current-resource', initialState: { projectPath } });
    await controller.init();

    const first = await controller.createSession();
    const threadId = first.thread.requireId();

    const restartedController = createController(storage, {
      resourceId: 'current-resource',
      initialState: { projectPath },
    });
    await restartedController.init();
    const restarted = await restartedController.createSession();

    expect(restarted.thread.requireId()).toBe(threadId);
  });
});

describe('AgentController session — cross-resource thread ownership', () => {
  it('cannot switch to a thread owned by another resource', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ resourceId: 'user-a' });
    const b = await controller.createSession({ resourceId: 'user-b' });

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
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ resourceId: 'user-a' });
    const b = await controller.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.delete({ threadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
    // a's thread still exists and is reachable by its owner.
    expect(await a.thread.getById({ threadId: aThreadId })).not.toBeNull();
  });

  it('cannot list messages of a thread owned by another resource', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ resourceId: 'user-a' });
    const b = await controller.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.listMessages({ threadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
  });

  it('cannot clone a thread owned by another resource', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ resourceId: 'user-a' });
    const b = await controller.createSession({ resourceId: 'user-b' });

    const aThreadId = a.thread.requireId();

    await expect(b.thread.clone({ sourceThreadId: aThreadId })).rejects.toThrow(`Thread not found: ${aThreadId}`);
  });

  it('only clones a cross-resource thread when the detected resource and project path still match', async () => {
    const storage = new InMemoryStore();
    const projectPath = '/tmp/mastra-project';
    const oldController = createController(storage, { resourceId: 'old-resource', initialState: { projectPath } });
    await oldController.init();
    const oldSession = await oldController.createSession();
    const oldThreadId = oldSession.thread.requireId();

    const currentController = createController(storage, {
      resourceId: 'current-resource',
      initialState: { projectPath },
    });
    await currentController.init();
    const currentSession = await currentController.createSession();

    await expect(
      currentSession.thread.cloneToCurrentResource({
        threadId: oldThreadId,
        expectedResourceId: 'another-resource',
        expectedProjectPath: projectPath,
      }),
    ).rejects.toThrow(`Thread not found: ${oldThreadId}`);

    await expect(
      currentSession.thread.cloneToCurrentResource({
        threadId: oldThreadId,
        expectedResourceId: 'old-resource',
        expectedProjectPath: '/tmp/other-project',
      }),
    ).rejects.toThrow(`Thread not found: ${oldThreadId}`);

    const clonedThread = await currentSession.thread.cloneToCurrentResource({
      threadId: oldThreadId,
      expectedResourceId: 'old-resource',
      expectedProjectPath: projectPath,
    });

    expect(await storage.stores.memory.getThreadById({ threadId: oldThreadId })).toMatchObject({
      id: oldThreadId,
      resourceId: 'old-resource',
    });
    expect(clonedThread).toMatchObject({
      resourceId: 'current-resource',
      metadata: { projectPath },
    });
    expect(clonedThread.id).not.toBe(oldThreadId);
  });

  it('still allows the owning resource to switch, list, and delete its own thread', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ resourceId: 'user-a' });
    const aThreadId = a.thread.requireId();

    // Owner can read its own messages and switch to its own thread.
    await expect(a.thread.listMessages({ threadId: aThreadId })).resolves.toEqual([]);
    await expect(a.thread.switch({ threadId: aThreadId })).resolves.toBeUndefined();

    // Owner can delete its own thread.
    await expect(a.thread.delete({ threadId: aThreadId })).resolves.toBeUndefined();
    expect(await a.thread.getById({ threadId: aThreadId })).toBeNull();
  });
});

describe('AgentController session registry', () => {
  it('resolves a created session by its resourceId', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'test-owner', resourceId: 'user-b' });

    expect(await controller.getSessionByResource('user-a')).toBe(a);
    expect(await controller.getSessionByResource('user-b')).toBe(b);
    expect(await controller.getSessionByResource('user-unknown')).toBeUndefined();
  });

  it('returns the same session for the same resourceId (get-or-create)', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const first = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const second = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });

    expect(second).toBe(first);
  });

  it('follows a session when its resourceId changes', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({ id: 'session-a', ownerId: 'test-owner', resourceId: 'user-a' });
    await controller.setResourceId(a, { resourceId: 'user-a-renamed' });

    expect(await controller.getSessionByResource('user-a-renamed')).toBe(a);
    expect(await controller.getSessionByResource('user-a')).toBeUndefined();
  });

  it('creates independent sessions for the same resourceId under different scopes', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
      tags: { projectPath: '/worktrees/a' },
    });
    const b = await controller.createSession({
      id: 'user-a::wt-b',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/b',
      tags: { projectPath: '/worktrees/b' },
    });

    expect(b).not.toBe(a);
    // Each scoped session has its own thread binding and mode/model state.
    expect(a.thread.getId()).not.toBe(b.thread.getId());
    await a.mode.switch({ modeId: 'plan' });
    expect(a.mode.get()).toBe('plan');
    expect(b.mode.get()).toBe('build');
  });

  it('keeps the resolved workspace isolated on each scoped session', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();
    const workspaceA = createMockWorkspace();
    const workspaceB = createMockWorkspace();

    const a = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
      workspace: workspaceA,
    });
    const b = await controller.createSession({
      id: 'user-a::wt-b',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/b',
      workspace: workspaceB,
    });

    expect(a.getWorkspace()).toBe(workspaceA);
    expect(b.getWorkspace()).toBe(workspaceB);
    expect(a.getWorkspace()).not.toBe(b.getWorkspace());
  });

  it('returns the same session for the same resourceId and scope (get-or-create)', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const first = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
    });
    const second = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
    });

    expect(second).toBe(first);
  });

  it('resolves scoped sessions independently via getSessionByResource', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const unscoped = await controller.createSession({ id: 'user-a', ownerId: 'test-owner', resourceId: 'user-a' });
    const scoped = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
    });

    expect(await controller.getSessionByResource('user-a')).toBe(unscoped);
    expect(await controller.getSessionByResource('user-a', '/worktrees/a')).toBe(scoped);
    expect(await controller.getSessionByResource('user-a', '/worktrees/other')).toBeUndefined();
  });

  it('keeps the scope when a scoped session is re-keyed to a new resourceId', async () => {
    const controller = createController(new InMemoryStore());
    await controller.init();

    const a = await controller.createSession({
      id: 'user-a::wt-a',
      ownerId: 'test-owner',
      resourceId: 'user-a',
      scope: '/worktrees/a',
    });
    await controller.setResourceId(a, { resourceId: 'user-a-renamed' });

    expect(await controller.getSessionByResource('user-a-renamed', '/worktrees/a')).toBe(a);
    expect(await controller.getSessionByResource('user-a', '/worktrees/a')).toBeUndefined();
  });

  it('exposes the authoritative scope through the session request context', async () => {
    let observedScope: string | undefined;
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a test agent.',
      model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
    });
    const controller = new AgentController({
      id: 'test-controller',
      storage: new InMemoryStore(),
      initialState: {},
      workspace: ({ requestContext }) => {
        observedScope = requestContext.get('controller')?.scope;
        return createMockWorkspace();
      },
      modes: [{ id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' }],
    });
    await controller.init();

    await controller.createSession({ resourceId: 'user-a', scope: '/worktrees/a' });

    expect(observedScope).toBe('/worktrees/a');
  });
});
