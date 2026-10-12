import { ThreadLockError } from '@mastra/code-sdk/utils/thread-lock';
import { describe, expect, it, vi } from 'vitest';
import { resumeThreadOnStartup } from './thread-startup.js';

function createThread(id: string, title: string, updatedAt: string) {
  return {
    id,
    title,
    resourceId: 'resource-1',
    metadata: { projectPath: '/tmp/project' },
    updatedAt: new Date(updatedAt),
  };
}

describe('resumeThreadOnStartup', () => {
  it('resumes the requested thread instead of the latest thread', async () => {
    const requested = {
      ...createThread('thread-requested', 'Requested', '2026-08-28T10:00:00Z'),
      resourceId: 'resource-2',
    };
    const latest = createThread('thread-latest', 'Latest', '2026-08-28T11:00:00Z');
    const setResourceId = vi.fn().mockResolvedValue(undefined);
    const switchThread = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: true,
      controller: { setResourceId },
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => 'thread-latest'),
          list: vi.fn().mockResolvedValue([latest, requested]),
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state, 'thread-requested');

    expect(setResourceId).toHaveBeenCalledWith(state.session, { resourceId: 'resource-2' });
    expect(switchThread).toHaveBeenCalledWith({ threadId: 'thread-requested' });
    expect(state.pendingNewThread).toBe(false);
  });

  it('reports an unknown requested thread and unbinds the auto-selected thread', async () => {
    const latest = createThread('thread-latest', 'Latest', '2026-08-28T11:00:00Z');
    const clearAndReleaseLock = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        thread: {
          getId: vi.fn(() => 'thread-latest'),
          list: vi.fn().mockResolvedValue([latest]),
          cleanupSubscription: vi.fn(),
          clearAndReleaseLock,
        },
      },
    } as any;

    await expect(resumeThreadOnStartup(state, 'missing-thread')).resolves.toEqual({
      kind: 'missing',
      threadId: 'missing-thread',
    });
    expect(state.session.thread.cleanupSubscription).toHaveBeenCalled();
    expect(clearAndReleaseLock).toHaveBeenCalled();
    expect(state.pendingNewThread).toBe(true);
  });

  it('reports a locked requested thread and unbinds the auto-selected thread', async () => {
    const latest = createThread('thread-latest', 'Latest', '2026-08-28T11:00:00Z');
    const requested = createThread('thread-requested', 'Requested', '2026-08-28T10:00:00Z');
    const switchThread = vi.fn().mockRejectedValue(new ThreadLockError('thread-requested', 4321));
    const clearAndReleaseLock = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      controller: { setResourceId: vi.fn() },
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => 'thread-latest'),
          list: vi.fn().mockResolvedValue([latest, requested]),
          switch: switchThread,
          cleanupSubscription: vi.fn(),
          clearAndReleaseLock,
        },
      },
    } as any;

    await expect(resumeThreadOnStartup(state, 'thread-requested')).resolves.toEqual({
      kind: 'locked',
      threadId: 'thread-requested',
      title: 'Requested',
      ownerPid: 4321,
    });
    expect(state.controller.setResourceId).not.toHaveBeenCalled();
    expect(clearAndReleaseLock).toHaveBeenCalled();
    expect(state.pendingNewThread).toBe(true);
  });

  it('restores the original resource when a cross-resource requested thread is locked', async () => {
    const requested = {
      ...createThread('thread-requested', 'Requested', '2026-08-28T10:00:00Z'),
      resourceId: 'resource-2',
    };
    let resourceId = 'resource-1';
    const setResourceId = vi.fn(async (_session: unknown, input: { resourceId: string }) => {
      resourceId = input.resourceId;
    });
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      controller: { setResourceId },
      session: {
        identity: { getResourceId: vi.fn(() => resourceId) },
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([requested]),
          switch: vi.fn().mockRejectedValue(new ThreadLockError('thread-requested', 4321)),
          cleanupSubscription: vi.fn(),
          clearAndReleaseLock: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any;

    await expect(resumeThreadOnStartup(state, 'thread-requested')).resolves.toMatchObject({ kind: 'locked' });
    expect(setResourceId.mock.calls.map(([, input]) => input.resourceId)).toEqual(['resource-2', 'resource-1']);
    expect(resourceId).toBe('resource-1');
    expect(state.pendingNewThread).toBe(true);
  });

  it('rethrows unexpected errors when switching to the requested thread', async () => {
    const requested = createThread('thread-requested', 'Requested', '2026-08-28T10:00:00Z');
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([requested]),
          switch: vi.fn().mockRejectedValue(new Error('storage offline')),
        },
      },
    } as any;

    await expect(resumeThreadOnStartup(state, 'thread-requested')).rejects.toThrow('storage offline');
  });

  it('keeps an active persisted thread without deleting it', async () => {
    const blank = createThread('thread-blank', '', '2026-08-28T11:01:00Z');
    const saved = createThread('thread-saved', 'Saved thread', '2026-08-28T11:00:00Z');
    const deleteThread = vi.fn();
    const switchThread = vi.fn();
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => 'thread-blank'),
          list: vi.fn().mockResolvedValue([blank, saved]),
          delete: deleteThread,
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(deleteThread).not.toHaveBeenCalled();
    expect(switchThread).not.toHaveBeenCalled();
  });

  it('resumes the latest unlocked thread for the current directory', async () => {
    const latest = createThread('thread-latest', 'Latest thread', '2026-08-28T11:00:00Z');
    const older = createThread('thread-older', 'Older thread', '2026-08-28T10:00:00Z');
    const switchThread = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([older, latest]),
          listMessages: vi.fn(),
          switch: switchThread,
          setSetting: vi.fn(),
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(switchThread).toHaveBeenCalledOnce();
    expect(switchThread).toHaveBeenCalledWith({ threadId: 'thread-latest' });
    expect(state.pendingNewThread).toBe(false);
  });

  it('keeps the controller lock when the latest thread is already active', async () => {
    const latest = createThread('thread-latest', 'Latest thread', '2026-08-28T11:00:00Z');
    const switchThread = vi.fn();
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        thread: {
          getId: vi.fn(() => 'thread-latest'),
          list: vi.fn().mockResolvedValue([latest]),
          listMessages: vi.fn(),
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(switchThread).not.toHaveBeenCalled();
    expect(state.pendingNewThread).toBe(false);
  });

  it('resumes the latest persisted thread without deleting it', async () => {
    const blank = createThread('thread-blank', '', '2026-08-28T11:01:00Z');
    const saved = createThread('thread-saved', 'Saved thread', '2026-08-28T11:00:00Z');
    const deleteThread = vi.fn();
    const switchThread = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([saved, blank]),
          delete: deleteThread,
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(deleteThread).not.toHaveBeenCalled();
    expect(switchThread).toHaveBeenCalledWith({ threadId: 'thread-blank' });
  });

  it('resumes the next thread when the latest is locked', async () => {
    const latest = createThread('thread-latest', 'Latest thread', '2026-08-28T11:00:00Z');
    const older = createThread('thread-older', 'Older thread', '2026-08-28T10:00:00Z');
    const switchThread = vi
      .fn()
      .mockRejectedValueOnce(new ThreadLockError('thread-latest', 1234))
      .mockResolvedValueOnce(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([older, latest]),
          listMessages: vi.fn(),
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(switchThread).toHaveBeenNthCalledWith(1, { threadId: 'thread-latest' });
    expect(switchThread).toHaveBeenNthCalledWith(2, { threadId: 'thread-older' });
    expect(state.pendingNewThread).toBe(false);
  });

  it('starts a new thread when every saved thread is locked', async () => {
    const latest = createThread('thread-latest', 'Latest thread', '2026-08-28T11:00:00Z');
    const older = createThread('thread-older', 'Older thread', '2026-08-28T10:00:00Z');
    const switchThread = vi
      .fn()
      .mockRejectedValueOnce(new ThreadLockError('thread-latest', 1234))
      .mockRejectedValueOnce(new ThreadLockError('thread-older', 5678));
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([older, latest]),
          listMessages: vi.fn(),
          switch: switchThread,
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(switchThread).toHaveBeenCalledTimes(2);
    expect(state.pendingNewThread).toBe(true);
  });
});
