import { describe, expect, it, vi } from 'vitest';

import { createLocalMastraTUIBackend } from './local-backend.js';

describe('createLocalMastraTUIBackend', () => {
  it('preserves the controller/session API through the neutral backend snapshot', async () => {
    const unsubscribe = vi.fn();
    const session = {
      identity: { getResourceId: () => 'project', getDefaultResourceId: () => 'project' },
      thread: {
        getId: () => 'thread-1',
        listMessages: vi.fn(async () => []),
      },
      mode: { get: () => 'build' },
      model: { get: () => 'model-1' },
      run: { isRunning: () => false },
      state: { get: () => ({ yolo: false }) },
      displayState: { get: () => ({ activeTools: new Map([['call-1', { name: 'read' }]]) }) },
      subscribe: vi.fn(() => unsubscribe),
    };
    const backend = createLocalMastraTUIBackend({ controller: { id: 'mastra-code' }, session });
    const onSnapshot = vi.fn();

    const connection = await backend.start({ onSnapshot, onEvent: vi.fn() });

    expect(connection.snapshot).toMatchObject({
      controllerId: 'mastra-code',
      resourceId: 'project',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'model-1',
      displayState: { activeTools: { 'call-1': { name: 'read' } } },
    });
    expect(backend.capabilities.localControlPlane).toBe(true);
    connection.unsubscribe();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('buffers live events until the authoritative snapshot is published', async () => {
    let subscriber: ((event: any) => void) | undefined;
    const order: string[] = [];
    const session = {
      identity: { getResourceId: () => 'project', getDefaultResourceId: () => 'project' },
      thread: { getId: () => null, listMessages: vi.fn(async () => []) },
      mode: { get: () => 'build' },
      model: { get: () => 'model-1' },
      run: { isRunning: () => false },
      state: { get: () => ({}) },
      displayState: { get: () => ({}) },
      subscribe: vi.fn((listener: (event: any) => void) => {
        subscriber = listener;
        return vi.fn();
      }),
    };
    const backend = createLocalMastraTUIBackend({ controller: { id: 'mastra-code' }, session });
    const started = backend.start({
      onSnapshot: () => order.push('snapshot'),
      onEvent: event => order.push(`event:${event.type}`),
    });
    subscriber?.({ type: 'agent_start' });
    await started;

    expect(order).toEqual(['snapshot', 'event:agent_start']);
  });

  it('adapts the exact controller and permission argument objects', async () => {
    const setResourceId = vi.fn(async () => {});
    const setForCategory = vi.fn(async () => {});
    const setForTool = vi.fn(async () => {});
    const setSetting = vi.fn(async () => {});
    const detachFromCurrent = vi.fn();
    const clearAndReleaseLock = vi.fn(async () => {});
    const session = {
      identity: { getDefaultResourceId: () => 'project' },
      permissions: { setForCategory, setForTool },
      thread: { setSetting, detachFromCurrent, clearAndReleaseLock },
    };
    const backend = createLocalMastraTUIBackend({ controller: { setResourceId }, session });

    await backend.setResourceId('resource-2');
    await backend.setCategoryPermission('edit', 'allow');
    await backend.setToolPermission('write_file', 'deny');
    await backend.setThreadSetting('projectPath', '/repo');
    await backend.detachThread();

    expect(setResourceId).toHaveBeenCalledWith(session, { resourceId: 'resource-2' });
    expect(setForCategory).toHaveBeenCalledWith({ category: 'edit', policy: 'allow' });
    expect(setForTool).toHaveBeenCalledWith({ toolName: 'write_file', policy: 'deny' });
    expect(setSetting).toHaveBeenCalledWith({ key: 'projectPath', value: '/repo' });
    expect(detachFromCurrent).toHaveBeenCalledOnce();
    expect(clearAndReleaseLock).toHaveBeenCalledOnce();
  });

  it('resolves full skill content instead of returning metadata only', async () => {
    const list = vi.fn(async () => [{ name: 'verify', path: '/skills/verify' }]);
    const get = vi.fn(async () => ({
      name: 'verify',
      path: '/skills/verify',
      instructions: 'Run the checks.',
      references: [],
      scripts: [],
      assets: [],
    }));
    const session = { identity: { getDefaultResourceId: () => 'project' } };
    const backend = createLocalMastraTUIBackend({
      controller: { getWorkspace: () => ({ skills: { list, get } }) },
      session,
    });

    await expect(backend.listSkills()).resolves.toEqual([
      expect.objectContaining({ name: 'verify', instructions: 'Run the checks.' }),
    ]);
    expect(get).toHaveBeenCalledWith('/skills/verify');
  });
});
