import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleThreadCommand } from '../thread.js';
import type { SlashCommandContext } from '../types.js';

function createMockHarness() {
  let currentThreadId: string | null = null;
  let currentResourceId = 'test-resource';

  const threads: Array<{
    id: string;
    resourceId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
  }> = [];

  return {
    getCurrentThreadId: vi.fn(() => currentThreadId),
    getResourceId: vi.fn(() => currentResourceId),
    listThreads: vi.fn(async () => threads),
    _setCurrentThreadId(threadId: string | null) {
      currentThreadId = threadId;
    },
    _setCurrentResourceId(resourceId: string) {
      currentResourceId = resourceId;
    },
    _addThread(thread: {
      id: string;
      resourceId: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
      metadata?: Record<string, unknown>;
    }) {
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
    expect(infoMessages[0]).toContain('Resource: test-resource');
    expect(infoMessages[0]).toContain('Pending new thread: yes');
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

    const lines = infoMessages[0]?.split('\n') ?? [];
    expect(lines[0]).toBe('Title: Debug Thread');
    expect(lines[1]).toBe('ID: thread-123');
    expect(lines[2]).toBe('Resource: test-resource');
    expect(lines[3]?.startsWith(`Created: ${createdAt.toISOString()} [`)).toBe(true);
    expect(lines[3]?.endsWith(']')).toBe(true);
    expect(lines[4]?.startsWith(`Updated: ${updatedAt.toISOString()} [`)).toBe(true);
    expect(lines[4]?.endsWith(']')).toBe(true);
    expect(infoMessages[0]).not.toContain('Pending new thread');
    expect(infoMessages[0]).not.toContain('Forked from:');
  });

  it('shows fork provenance when the active thread is a clone', async () => {
    const createdAt = new Date('2026-03-25T20:27:03.643Z');
    const updatedAt = new Date('2026-03-25T22:18:09.046Z');
    const clonedAt = new Date('2026-03-25T21:00:00.000Z');

    harness._addThread({
      id: 'thread-456',
      resourceId: 'test-resource',
      title: 'Forked Thread',
      createdAt,
      updatedAt,
      metadata: {
        clone: {
          sourceThreadId: 'thread-123',
          clonedAt,
        },
      },
    });
    harness._setCurrentThreadId('thread-456');

    await handleThreadCommand(ctx);

    expect(infoMessages[0]).toContain('Forked from: thread-123');
    expect(infoMessages[0]).toContain(`Forked at: ${clonedAt.toISOString()} [`);
    expect(infoMessages[0]).toContain(']');
  });

  it('falls back to current resource when the active thread is not in the listed threads', async () => {
    harness._setCurrentThreadId('missing-thread');
    harness._setCurrentResourceId('runtime-resource');

    await handleThreadCommand(ctx);

    const lines = infoMessages[0]?.split('\n') ?? [];
    expect(lines[0]).toBe('Title: (untitled)');
    expect(lines[1]).toBe('ID: missing-thread');
    expect(lines[2]).toBe('Resource: runtime-resource');
    expect(infoMessages[0]).not.toContain('Pending new thread');
    expect(infoMessages[0]).not.toContain('Forked from:');
    expect(infoMessages[0]).not.toContain('Created:');
    expect(infoMessages[0]).not.toContain('Updated:');
  });
});
