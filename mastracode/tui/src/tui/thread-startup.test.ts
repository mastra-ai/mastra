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

  it('reports an unknown requested thread', async () => {
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      session: {
        thread: {
          getId: vi.fn(() => null),
          list: vi.fn().mockResolvedValue([]),
        },
      },
    } as any;

    await expect(resumeThreadOnStartup(state, 'missing-thread')).rejects.toThrow('Thread not found: missing-thread');
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
