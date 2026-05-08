import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleResourceCommand } from '../resource.js';
import type { SlashCommandContext } from '../types.js';

/**
 * Minimal mock harness that satisfies what handleResourceCommand calls.
 * Threads are stored in-memory so we can test the "resume latest thread"
 * vs "no threads → pendingNewThread" paths.
 */
function createMockHarness(opts?: { id?: string; resourceId?: string }) {
  const id = opts?.id ?? 'test-harness';
  const defaultResourceId = opts?.resourceId ?? id;
  let currentResourceId = defaultResourceId;
  let currentThreadId: string | null = null;

  const threads: Array<{
    id: string;
    resourceId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  return {
    getResourceId: vi.fn(() => currentResourceId),
    getDefaultResourceId: vi.fn(() => defaultResourceId),
    getKnownResourceIds: vi.fn(async () => [...new Set(threads.map(t => t.resourceId))]),
    setResourceId: vi.fn(({ resourceId }: { resourceId: string }) => {
      currentResourceId = resourceId;
      currentThreadId = null;
    }),
    listThreads: vi.fn(async () => threads.filter(t => t.resourceId === currentResourceId)),
    switchThread: vi.fn(async ({ threadId }: { threadId: string }) => {
      currentThreadId = threadId;
    }),
    getCurrentThreadId: vi.fn(() => currentThreadId),

    // Test helpers
    _addThread(resourceId: string, title: string, updatedAt: Date) {
      const id = `thread-${threads.length + 1}`;
      threads.push({
        id,
        resourceId,
        title,
        createdAt: updatedAt,
        updatedAt,
      });
      return id;
    },
  };
}

function createMockCtx(harness: ReturnType<typeof createMockHarness>) {
  const infoMessages: string[] = [];
  const errorMessages: string[] = [];

  return {
    ctx: {
      state: {
        pendingNewThread: false,
        chatContainer: { clear: vi.fn() },
        pendingTools: { clear: vi.fn() },
        allToolComponents: [] as any[],
        allSystemReminderComponents: [] as any[],
        allShellComponents: [] as any[],
        messageComponentsById: new Map<string, any>(),
        ui: { requestRender: vi.fn() },
      },
      harness: harness as any,
      showInfo: vi.fn((msg: string) => infoMessages.push(msg)),
      showError: vi.fn((msg: string) => errorMessages.push(msg)),
      updateStatusLine: vi.fn(),
      renderExistingMessages: vi.fn(async () => {}),
      stop: vi.fn(),
      getResolvedWorkspace: vi.fn(),
      addUserMessage: vi.fn(),
      showOnboarding: vi.fn(async () => {}),
      customSlashCommands: [],
    } as unknown as SlashCommandContext,
    infoMessages,
    errorMessages,
  };
}

describe('handleResourceCommand', () => {
  let harness: ReturnType<typeof createMockHarness>;
  let ctx: SlashCommandContext;
  let infoMessages: string[];

  beforeEach(() => {
    harness = createMockHarness();
    const mock = createMockCtx(harness);
    ctx = mock.ctx;
    infoMessages = mock.infoMessages;
  });

  describe('no args (info display)', () => {
    it('shows current resource ID and known IDs', async () => {
      harness._addThread('test-harness', 'thread-a', new Date());
      await handleResourceCommand(ctx, []);

      expect(harness.getKnownResourceIds).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('Current: test-harness');
      expect(infoMessages[0]).toContain('Known resource IDs:');
    });

    it('shows auto-detected note when resource has been overridden', async () => {
      harness.setResourceId({ resourceId: 'custom-id' });
      await handleResourceCommand(ctx, []);

      expect(infoMessages[0]).toContain('auto-detected: test-harness');
    });
  });

  describe('switching to same resource', () => {
    it('shows already-on message and does not switch', async () => {
      await handleResourceCommand(ctx, ['test-harness']);

      expect(infoMessages[0]).toBe('Already on resource: test-harness');
      expect(harness.switchThread).not.toHaveBeenCalled();
      expect(ctx.state.pendingNewThread).toBe(false);
    });
  });

  describe('switching to a resource with existing threads', () => {
    it('resumes the most recently updated thread', async () => {
      const oldDate = new Date('2025-01-01');
      const newDate = new Date('2025-06-01');
      harness._addThread('other-resource', 'old-thread', oldDate);
      const latestId = harness._addThread('other-resource', 'latest-thread', newDate);

      await handleResourceCommand(ctx, ['other-resource']);

      expect(harness.setResourceId).toHaveBeenCalledWith({ resourceId: 'other-resource' });
      expect(harness.switchThread).toHaveBeenCalledWith({ threadId: latestId });
      expect(ctx.state.pendingNewThread).toBe(false);
      expect(ctx.renderExistingMessages).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('resumed thread: latest-thread');
    });

    it('clears UI state before switching', async () => {
      harness._addThread('other-resource', 'a-thread', new Date());

      await handleResourceCommand(ctx, ['other-resource']);

      expect(ctx.state.chatContainer.clear).toHaveBeenCalled();
      expect(ctx.state.pendingTools.clear).toHaveBeenCalled();
      expect(ctx.state.allToolComponents).toEqual([]);
    });
  });

  describe('switching to a resource with no threads', () => {
    it('sets pendingNewThread and does not call switchThread', async () => {
      await handleResourceCommand(ctx, ['brand-new-resource']);

      expect(harness.setResourceId).toHaveBeenCalledWith({ resourceId: 'brand-new-resource' });
      expect(harness.switchThread).not.toHaveBeenCalled();
      expect(ctx.state.pendingNewThread).toBe(true);
      expect(infoMessages[0]).toContain('no existing threads');
      expect(infoMessages[0]).toContain('brand-new-resource');
    });
  });

  describe('reset', () => {
    it('resets to the default resource ID and resumes latest thread', async () => {
      harness._addThread('test-harness', 'default-thread', new Date());
      harness.setResourceId({ resourceId: 'some-other' });

      await handleResourceCommand(ctx, ['reset']);

      expect(harness.setResourceId).toHaveBeenLastCalledWith({ resourceId: 'test-harness' });
      expect(harness.switchThread).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('Resource ID reset to: test-harness');
      expect(infoMessages[0]).toContain('resumed thread: default-thread');
    });

    it('resets to default with no threads available', async () => {
      harness.setResourceId({ resourceId: 'some-other' });

      await handleResourceCommand(ctx, ['reset']);

      expect(ctx.state.pendingNewThread).toBe(true);
      expect(infoMessages[0]).toContain('Resource ID reset to: test-harness');
      expect(infoMessages[0]).toContain('no existing threads');
    });
  });
});
