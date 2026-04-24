import type { HarnessEvent, HarnessThread } from '@mastra/core/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchEvent } from '../event-dispatch.js';
import type { TUIState } from '../state.js';

vi.mock('../../utils/project.js', () => ({
  getCurrentGitBranch: vi.fn(() => null),
}));

function createHarness() {
  const state: {
    tasks: unknown[];
    activePlan: unknown | null;
    sandboxAllowedPaths: string[];
    escapeAsCancel?: boolean;
  } = {
    tasks: [
      { content: 'leftover task', status: 'pending', activeForm: 'leftover task' },
    ],
    activePlan: { title: 'stale plan', plan: 'stale', approvedAt: new Date().toISOString() },
    sandboxAllowedPaths: ['/tmp/leftover-allowed-path'],
  };

  return {
    state,
    getState: vi.fn(() => state),
    setState: vi.fn(async (updates: Record<string, unknown>) => {
      Object.assign(state, updates);
    }),
    loadOMProgress: vi.fn(async () => {}),
    listThreads: vi.fn(async (): Promise<HarnessThread[]> => [
      {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Thread 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      } as HarnessThread,
    ]),
  };
}

function createState(harness: ReturnType<typeof createHarness>): TUIState {
  return {
    harness: harness as any,
    editor: { escapeEnabled: true },
    projectInfo: { rootPath: '/tmp' },
    taskProgress: { updateTasks: vi.fn() },
    ui: { requestRender: vi.fn() },
    taskWriteInsertIndex: 0,
    currentThreadTitle: undefined,
  } as unknown as TUIState;
}

function createEctx() {
  return {
    showInfo: vi.fn(),
    renderExistingMessages: vi.fn(async () => {}),
  } as any;
}

describe('event-dispatch thread state clearing', () => {
  let harness: ReturnType<typeof createHarness>;
  let state: TUIState;

  beforeEach(() => {
    harness = createHarness();
    state = createState(harness);
  });

  it('clears tasks, activePlan, and sandboxAllowedPaths on thread_changed', async () => {
    const event: HarnessEvent = {
      type: 'thread_changed',
      threadId: 'thread-1',
      previousThreadId: 'thread-0',
    } as HarnessEvent;

    await dispatchEvent(event, createEctx(), state);

    expect(harness.setState).toHaveBeenCalledWith({
      tasks: [],
      activePlan: null,
      sandboxAllowedPaths: [],
    });
    expect(harness.state.tasks).toEqual([]);
    expect(harness.state.activePlan).toBeNull();
    expect(harness.state.sandboxAllowedPaths).toEqual([]);
    expect((state.taskProgress!.updateTasks as any)).toHaveBeenCalledWith([]);
    expect(state.taskWriteInsertIndex).toBe(-1);
  });

  it('clears tasks, activePlan, and sandboxAllowedPaths on thread_created', async () => {
    const event: HarnessEvent = {
      type: 'thread_created',
      thread: {
        id: 'thread-2',
        resourceId: 'resource-1',
        title: 'Thread 2',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    } as HarnessEvent;

    await dispatchEvent(event, createEctx(), state);

    expect(harness.setState).toHaveBeenCalledWith({
      tasks: [],
      activePlan: null,
      sandboxAllowedPaths: [],
    });
    expect(harness.state.tasks).toEqual([]);
    expect(harness.state.activePlan).toBeNull();
    expect(harness.state.sandboxAllowedPaths).toEqual([]);
    expect((state.taskProgress!.updateTasks as any)).toHaveBeenCalledWith([]);
    expect(state.taskWriteInsertIndex).toBe(-1);
    expect(state.currentThreadTitle).toBe('Thread 2');
  });
});
