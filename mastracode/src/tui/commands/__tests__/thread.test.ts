import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleThreadCommand } from '../thread.js';
import type { SlashCommandContext } from '../types.js';

function createMockHarness() {
  let currentThreadId: string | null = null;
  let currentResourceId = 'test-resource';
  const defaultResourceId = 'default-resource';

  const threads: Array<{
    id: string;
    resourceId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  return {
    getCurrentThreadId: vi.fn(() => currentThreadId),
    getResourceId: vi.fn(() => currentResourceId),
    getDefaultResourceId: vi.fn(() => defaultResourceId),
    listThreads: vi.fn(async () => threads),
    _setCurrentThreadId(threadId: string | null) {
      currentThreadId = threadId;
    },
    _setCurrentResourceId(resourceId: string) {
      currentResourceId = resourceId;
    },
    _addThread(thread: { id: string; resourceId: string; title: string; createdAt: Date; updatedAt: Date }) {
      threads.push(thread);
    },
  };
}

function createMockCtx(harness: ReturnType<typeof createMockHarness>) {
  const infoMessages: string[] = [];

  return {
    ctx: {
      state: {
        pendingNewThread: false,
      },
      harness: harness as any,
      showInfo: vi.fn((msg: string) => infoMessages.push(msg)),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
      renderExistingMessages: vi.fn(async () => {}),
      stop: vi.fn(),
      getResolvedWorkspace: vi.fn(),
      addUserMessage: vi.fn(),
      showOnboarding: vi.fn(async () => {}),
      customSlashCommands: [],
    } as unknown as SlashCommandContext,
    infoMessages,
  };
}

describe('handleThreadCommand', () => {
  let harness: ReturnType<typeof createMockHarness>;
  let ctx: SlashCommandContext;
  let infoMessages: string[];

  beforeEach(() => {
    harness = createMockHarness();
    const mock = createMockCtx(harness);
    ctx = mock.ctx;
    infoMessages = mock.infoMessages;
  });

  it('shows no-active-thread info when there is no current thread', async () => {
    ctx.state.pendingNewThread = true;

    await handleThreadCommand(ctx);

    expect(infoMessages[0]).toContain('No active thread.');
    expect(infoMessages[0]).toContain('Pending new thread: yes');
    expect(infoMessages[0]).toContain('Current resource: test-resource');
    expect(infoMessages[0]).toContain('Default resource: default-resource');
  });

  it('shows current thread details when a thread is active', async () => {
    const createdAt = new Date('2026-03-25T20:27:03.643Z');
    const updatedAt = new Date('2026-03-25T22:18:09.046Z');
    harness._addThread({
      id: 'thread-123',
      resourceId: 'test-resource',
      title: 'Debug Thread',
      createdAt,
      updatedAt,
    });
    harness._setCurrentThreadId('thread-123');

    await handleThreadCommand(ctx);

    expect(infoMessages[0]).toContain('Current thread: thread-123');
    expect(infoMessages[0]).toContain('Title: Debug Thread');
    expect(infoMessages[0]).toContain('Resource: test-resource');
    expect(infoMessages[0]).toContain('Default resource: default-resource');
    expect(infoMessages[0]).toContain('Pending new thread: no');
    expect(infoMessages[0]).toContain(`Created: ${createdAt.toISOString()}`);
    expect(infoMessages[0]).toContain(`Updated: ${updatedAt.toISOString()}`);
  });

  it('falls back to current resource when the active thread is not in the listed threads', async () => {
    harness._setCurrentThreadId('missing-thread');
    harness._setCurrentResourceId('runtime-resource');

    await handleThreadCommand(ctx);

    expect(infoMessages[0]).toContain('Current thread: missing-thread');
    expect(infoMessages[0]).toContain('Title: (untitled)');
    expect(infoMessages[0]).toContain('Resource: runtime-resource');
    expect(infoMessages[0]).not.toContain('Created:');
    expect(infoMessages[0]).not.toContain('Updated:');
  });
});
