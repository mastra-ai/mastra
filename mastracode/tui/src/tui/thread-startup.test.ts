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
  it('deletes an unsent startup thread before resuming saved work', async () => {
    const blank = createThread('thread-blank', '', '2026-08-28T11:01:00Z');
    const saved = createThread('thread-saved', 'Saved thread', '2026-08-28T11:00:00Z');
    const deleteThread = vi.fn().mockResolvedValue(undefined);
    const switchThread = vi.fn().mockResolvedValue(undefined);
    const state = {
      projectInfo: { rootPath: '/tmp/project' },
      pendingNewThread: false,
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => 'thread-blank'),
          list: vi.fn().mockResolvedValue([blank, saved]),
          listMessages: vi.fn().mockResolvedValue([]),
          delete: deleteThread,
          switch: switchThread,
          setSetting: vi.fn(),
        },
      },
    } as any;

    await resumeThreadOnStartup(state);

    expect(deleteThread).toHaveBeenCalledWith({ threadId: 'thread-blank' });
    expect(switchThread).toHaveBeenCalledWith({ threadId: 'thread-saved' });
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
});
