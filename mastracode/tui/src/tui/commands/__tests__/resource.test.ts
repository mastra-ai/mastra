import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAgentController as createBaseMockAgentController } from '../../__tests__/agent-controller-mock.js';
import { handleResourceCommand } from '../resource.js';
import type { SlashCommandContext } from '../types.js';

/**
 * Mock controller for handleResourceCommand, built on the shared TUI mock factory.
 * Threads are stored in-memory so we can test the "resume latest thread" vs
 * "no threads → pendingNewThread" paths. Resource/thread state is tracked here
 * and surfaced through the shared session/controller mock surface.
 */
function createMockAgentController(opts?: { id?: string; resourceId?: string }) {
  const id = opts?.id ?? 'test-controller';
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

  const controller = createBaseMockAgentController({
    id,
    resourceId: defaultResourceId,
    session: {
      identity: {
        getResourceId: vi.fn(() => currentResourceId),
        getDefaultResourceId: vi.fn(() => defaultResourceId),
      },
      thread: {
        getId: vi.fn(() => currentThreadId),
        list: vi.fn(async () => threads.filter(t => t.resourceId === currentResourceId)),
        switch: vi.fn(async ({ threadId }: { threadId: string }) => {
          currentThreadId = threadId;
        }),
      },
    },
    controller: {
      getKnownResourceIds: vi.fn(async (_session: any) => [...new Set(threads.map(t => t.resourceId))]),
      setResourceId: vi.fn((_session: any, { resourceId }: { resourceId: string }) => {
        currentResourceId = resourceId;
        currentThreadId = null;
      }),
    },
  });

  return Object.assign(controller, {
    // Test helper
    _addThread(resourceId: string, title: string, updatedAt: Date) {
      const threadId = `thread-${threads.length + 1}`;
      threads.push({ id: threadId, resourceId, title, createdAt: updatedAt, updatedAt });
      return threadId;
    },
  });
}

function createMockCtx(controller: ReturnType<typeof createMockAgentController>) {
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
        session: (controller as any).session,
        ui: { requestRender: vi.fn() },
      },
      controller: controller as any,
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
  let controller: ReturnType<typeof createMockAgentController>;
  let ctx: SlashCommandContext;
  let infoMessages: string[];

  beforeEach(() => {
    controller = createMockAgentController();
    const mock = createMockCtx(controller);
    ctx = mock.ctx;
    infoMessages = mock.infoMessages;
  });

  describe('no args (info display)', () => {
    it('shows current resource ID and known IDs', async () => {
      controller._addThread('test-controller', 'thread-a', new Date());
      await handleResourceCommand(ctx, []);

      expect(controller.getKnownResourceIds).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('Current: test-controller');
      expect(infoMessages[0]).toContain('Known resource IDs:');
    });

    it('shows auto-detected note when resource has been overridden', async () => {
      controller.setResourceId(undefined as any, { resourceId: 'custom-id' });
      await handleResourceCommand(ctx, []);

      expect(infoMessages[0]).toContain('auto-detected: test-controller');
    });
  });

  describe('switching to same resource', () => {
    it('shows already-on message and does not switch', async () => {
      await handleResourceCommand(ctx, ['test-controller']);

      expect(infoMessages[0]).toBe('Already on resource: test-controller');
      expect(controller.session.thread.switch).not.toHaveBeenCalled();
      expect(ctx.state.pendingNewThread).toBe(false);
    });
  });

  describe('switching to a resource with existing threads', () => {
    it('resumes the most recently updated thread', async () => {
      const oldDate = new Date('2025-01-01');
      const newDate = new Date('2025-06-01');
      controller._addThread('other-resource', 'old-thread', oldDate);
      const latestId = controller._addThread('other-resource', 'latest-thread', newDate);

      await handleResourceCommand(ctx, ['other-resource']);

      expect(controller.setResourceId).toHaveBeenCalledWith(expect.anything(), { resourceId: 'other-resource' });
      expect(controller.session.thread.switch).toHaveBeenCalledWith({ threadId: latestId, emitEvent: false });
      expect(ctx.state.pendingNewThread).toBe(false);
      expect(ctx.renderExistingMessages).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('resumed thread: latest-thread');
    });

    it('clears UI state before switching', async () => {
      controller._addThread('other-resource', 'a-thread', new Date());

      await handleResourceCommand(ctx, ['other-resource']);

      expect(ctx.state.chatContainer.clear).toHaveBeenCalled();
      expect(ctx.state.pendingTools.clear).toHaveBeenCalled();
      expect(ctx.state.allToolComponents).toEqual([]);
    });
  });

  describe('switching to a resource with no threads', () => {
    it('sets pendingNewThread and does not call switchThread', async () => {
      await handleResourceCommand(ctx, ['brand-new-resource']);

      expect(controller.setResourceId).toHaveBeenCalledWith(expect.anything(), { resourceId: 'brand-new-resource' });
      expect(controller.session.thread.switch).not.toHaveBeenCalled();
      expect(ctx.state.pendingNewThread).toBe(true);
      expect(infoMessages[0]).toContain('no existing threads');
      expect(infoMessages[0]).toContain('brand-new-resource');
    });
  });

  describe('reset', () => {
    it('resets to the default resource ID and resumes latest thread', async () => {
      controller._addThread('test-controller', 'default-thread', new Date());
      controller.setResourceId(undefined as any, { resourceId: 'some-other' });

      await handleResourceCommand(ctx, ['reset']);

      expect(controller.setResourceId).toHaveBeenLastCalledWith(expect.anything(), { resourceId: 'test-controller' });
      expect(controller.session.thread.switch).toHaveBeenCalled();
      expect(infoMessages[0]).toContain('Resource ID reset to: test-controller');
      expect(infoMessages[0]).toContain('resumed thread: default-thread');
    });

    it('resets to default with no threads available', async () => {
      controller.setResourceId(undefined as any, { resourceId: 'some-other' });

      await handleResourceCommand(ctx, ['reset']);

      expect(ctx.state.pendingNewThread).toBe(true);
      expect(infoMessages[0]).toContain('Resource ID reset to: test-controller');
      expect(infoMessages[0]).toContain('no existing threads');
    });
  });
});
