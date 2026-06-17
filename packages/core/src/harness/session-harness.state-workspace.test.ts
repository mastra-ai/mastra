import { RequestContext } from '../request-context';
import { describe, expect, it, vi } from 'vitest';

import type { MastraMemory, StorageThreadType } from '../memory';
import { HarnessStorage } from '../storage/domains/harness';
import type { SessionRecord } from '../storage/domains/harness';
import { Workspace } from '../workspace';
import { Harness } from './session-harness';
import type { HarnessConfig } from './session-harness.types';
import type { HarnessMode } from './session-mode';
import { buildHarnessRequestContext } from './session-request-context';

class RecordingHarnessStorage extends HarnessStorage {
  readonly records = new Map<string, SessionRecord>();

  async dangerouslyClearAll(): Promise<void> {
    this.records.clear();
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.records.get(sessionId) ?? null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.records.values()];
  }
}

const modes: HarnessMode[] = [{ id: 'build', defaultModelId: 'test-model' }];

const createMemory = () =>
  ({
    getThreadById: vi.fn().mockResolvedValue({
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Thread',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies StorageThreadType),
    recall: vi.fn().mockResolvedValue({ messages: [] }),
    saveMessages: vi.fn().mockImplementation(async ({ messages }) => ({ messages })),
    cloneThread: vi.fn(),
  }) as unknown as MastraMemory;

type TestHarnessConfig<TState> = Partial<
  Omit<HarnessConfig<HarnessMode[], TState>, 'agent' | 'mastra' | 'modes' | 'defaultModeId' | 'storage' | 'memory'>
> & {
  memory?: HarnessConfig<HarnessMode[], TState>['memory'];
};

const createHarness = <TState extends Record<string, unknown>>(config: TestHarnessConfig<TState> = {}) => {
  const storage = new RecordingHarnessStorage();
  const memory = createMemory();
  const harness = new Harness<HarnessMode[], TState>({
    agent: {} as never,
    storage,
    memory,
    modes,
    defaultModeId: 'build',
    ...config,
  });
  return { harness, storage, memory };
};

describe('Session harness state', () => {
  it('initializes sessions from schema defaults and initial state', async () => {
    const { harness } = createHarness<{ count: number; label: string }>({
      stateSchema: {
        type: 'object',
        properties: { count: { type: 'number', default: 1 }, label: { type: 'string' } },
        required: ['count', 'label'],
      },
      initialState: { count: 2, label: 'ready' },
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(session.getState()).toEqual({ count: 2, label: 'ready' });
    expect(Object.isFrozen(session.getState())).toBe(true);
  });

  it('validates setState and emits state_changed events', async () => {
    const { harness } = createHarness<{ count: number }>({
      stateSchema: {
        type: 'object',
        properties: { count: { type: 'number', default: 0 } },
        required: ['count'],
      },
    });
    const events: unknown[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    await session.setState({ count: 1 });

    expect(session.getState()).toEqual({ count: 1 });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'state_changed', state: { count: 1 }, changedKeys: ['count'] }),
    );
    await expect(session.setState({ count: 'bad' as never })).rejects.toThrow('Invalid state update');
    expect(session.getState()).toEqual({ count: 1 });
  });

  it('runs updateState as a serialized transaction', async () => {
    const { harness } = createHarness<{ count: number }>({
      initialState: { count: 0 },
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    const result = await session.updateState(state => ({
      updates: { count: state.count + 1 },
      result: state.count,
    }));

    expect(result).toBe(0);
    expect(session.getState()).toEqual({ count: 1 });
  });
});

describe('Session harness request context', () => {
  it('builds a detached per-execution overlay without mutating caller context', () => {
    const callerContext = new RequestContext<unknown>([
      ['harness', { sessionId: 'caller-session' }],
      ['tenant', 'tenant-1'],
    ]);
    const harnessContext = {
      harnessId: 'owner-1',
      ownerId: 'owner-1',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      modeId: 'build',
      modelId: 'test-model',
      subagentDepth: 0,
      source: { type: 'top-level' as const },
      getState: () => ({ count: 1 }),
    };

    const overlay = buildHarnessRequestContext({ harnessContext });

    expect(overlay).not.toBe(callerContext);
    expect(overlay.has('tenant')).toBe(false);
    expect(overlay.get('harness')).toBe(harnessContext);
    expect(callerContext.get('harness')).toEqual({ sessionId: 'caller-session' });
  });
});

describe('Session harness workspace', () => {
  it('keeps configured workspace instances and config-created workspaces internal to the session', async () => {
    const workspace = new Workspace({ name: 'instance-workspace', skills: ['.'] });
    let instanceHarnessContext: Record<string, unknown> | undefined;
    const instanceMemory = vi.fn(({ requestContext }) => {
      instanceHarnessContext = requestContext.get('harness');
      return createMemory();
    });
    const { harness: instanceHarness } = createHarness({ workspace, memory: instanceMemory });

    await (await instanceHarness.session({ threadId: 'thread-1', resourceId: 'resource-1' })).getThread();

    expect(instanceHarnessContext).toMatchObject({ sessionId: expect.any(String), resourceId: 'resource-1' });
    expect(instanceHarnessContext).not.toHaveProperty('workspace');

    let configHarnessContext: Record<string, unknown> | undefined;
    const configMemory = vi.fn(({ requestContext }) => {
      configHarnessContext = requestContext.get('harness');
      return createMemory();
    });
    const { harness: configHarness } = createHarness({
      workspace: { name: 'config-workspace', skills: ['.'] },
      memory: configMemory,
    });

    await (await configHarness.session({ threadId: 'thread-1', resourceId: 'resource-1' })).getThread();

    expect(configHarnessContext).toMatchObject({ sessionId: expect.any(String), resourceId: 'resource-1' });
    expect(configHarnessContext).not.toHaveProperty('workspace');
  });

  it('resolves dynamic workspaces once and keeps them off the request context', async () => {
    const workspace = new Workspace({ name: 'dynamic-workspace', skills: ['.'] });
    let harnessContext: Record<string, unknown> | undefined;
    const memory = vi.fn(({ requestContext }) => {
      harnessContext = requestContext.get('harness');
      return createMemory();
    });
    const workspaceFactory = vi.fn(() => workspace);
    const { harness } = createHarness({
      memory,
      workspace: workspaceFactory,
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    await session.getThread();
    await session.getThread();

    expect(harnessContext).not.toHaveProperty('workspace');
    expect(workspaceFactory).toHaveBeenCalledTimes(1);
    expect('getWorkspace' in harness).toBe(false);
  });
});
