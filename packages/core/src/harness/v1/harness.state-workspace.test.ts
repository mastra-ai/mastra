import { describe, expect, it, vi } from 'vitest';

import type { MastraMemory, StorageThreadType } from '../../memory';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import { Workspace } from '../../workspace';
import { Harness } from './harness';
import type { HarnessConfig } from './harness.types';
import type { HarnessMode } from './mode';

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

const modes: HarnessMode[] = [{ id: 'build', agentId: 'default', defaultModelId: 'test-model' }];

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
  Omit<HarnessConfig<HarnessMode[], TState>, 'agents' | 'mastra' | 'modes' | 'defaultModeId' | 'storage' | 'memory'>
> & {
  memory?: HarnessConfig<HarnessMode[], TState>['memory'];
};

const createHarness = <TState extends Record<string, unknown>>(config: TestHarnessConfig<TState> = {}) => {
  const storage = new RecordingHarnessStorage();
  const memory = createMemory();
  const harness = new Harness<HarnessMode[], TState>({
    agents: {},
    storage,
    memory,
    modes,
    defaultModeId: 'build',
    ...config,
  });
  return { harness, storage, memory };
};

describe('Harness v1 state', () => {
  it('initializes from schema defaults and initial state', () => {
    const { harness } = createHarness<{ count: number; label: string }>({
      stateSchema: {
        type: 'object',
        properties: { count: { type: 'number', default: 1 }, label: { type: 'string' } },
        required: ['count', 'label'],
      },
      initialState: { count: 2, label: 'ready' },
    });

    expect(harness.getState()).toEqual({ count: 2, label: 'ready' });
    expect(Object.isFrozen(harness.getState())).toBe(true);
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

    await harness.setState({ count: 1 });

    expect(harness.getState()).toEqual({ count: 1 });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'state_changed', state: { count: 1 }, changedKeys: ['count'] }),
    );
    await expect(harness.setState({ count: 'bad' as never })).rejects.toThrow('Invalid state update');
    expect(harness.getState()).toEqual({ count: 1 });
  });

  it('runs updateState as a serialized transaction', async () => {
    const { harness } = createHarness<{ count: number }>({
      initialState: { count: 0 },
    });

    const result = await harness.updateState(state => ({
      updates: { count: state.count + 1 },
      result: state.count,
    }));

    expect(result).toBe(0);
    expect(harness.getState()).toEqual({ count: 1 });
  });
});

describe('Harness v1 workspace', () => {
  it('returns configured workspace instances and config-created workspaces', () => {
    const workspace = new Workspace({ name: 'instance-workspace', skills: ['.'] });
    expect(createHarness({ workspace }).harness.getWorkspace()).toBe(workspace);
    expect(createHarness({ workspace: { name: 'config-workspace', skills: ['.'] } }).harness.getWorkspace()?.name).toBe(
      'config-workspace',
    );
  });

  it('resolves dynamic workspaces into request context and caches them on the harness', async () => {
    const workspace = new Workspace({ name: 'dynamic-workspace', skills: ['.'] });
    let harnessContext: { workspace?: Workspace } | undefined;
    const memory = vi.fn(({ requestContext }) => {
      harnessContext = requestContext.get('harness');
      return createMemory();
    });
    const { harness } = createHarness({
      memory,
      workspace: vi.fn(() => workspace),
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    await session.getThread();

    expect(harnessContext?.workspace).toBe(workspace);
    expect(harness.getWorkspace()).toBe(workspace);
  });
});
