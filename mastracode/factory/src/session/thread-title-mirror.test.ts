import type { AgentControllerEvent, AgentControllerThread } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import {
  observeSessionThreadTitle,
  type ThreadTitleMirrorDependencies,
  type ThreadTitleMirrorSession,
} from './thread-title-mirror.js';

function createSession(title?: string) {
  const listeners: Array<(event: AgentControllerEvent) => void> = [];
  const getById = vi.fn(
    async ({ threadId }: { threadId: string }): Promise<AgentControllerThread | null> => ({
      id: threadId,
      resourceId: 'resource-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    }),
  );
  const session: ThreadTitleMirrorSession = {
    identity: { getResourceId: () => 'resource-1' },
    thread: { getById },
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
  const emit = (event: AgentControllerEvent) => {
    for (const listener of [...listeners]) listener(event);
  };
  return { session, emit, getById };
}

function createRow(title: string | null): SourceControlSession {
  return {
    id: 'row-1',
    sessionId: 'resource-1',
    projectRepositoryId: 'project-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'user/session-resource-1',
    title,
    visibility: 'private',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    firstMessageAt: null,
    firstMeaningfulExecAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createDependencies(rowTitle: string | null = null): ThreadTitleMirrorDependencies {
  return {
    sourceControl: {
      sessions: {
        getBySessionId: vi.fn(async () => createRow(rowTitle)),
        rename: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

describe('observeSessionThreadTitle', () => {
  it('renames the session row when core names the thread', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies('write a parser for the log format');
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_title_updated', threadId: 'thread-1', title: 'Log format parser' });

    await vi.waitFor(() =>
      expect(dependencies.sourceControl.sessions.rename).toHaveBeenCalledExactlyOnceWith({
        sessionId: 'resource-1',
        title: 'Log format parser',
      }),
    );
  });

  it('renames the session row when observational memory refines the title', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies('Log format parser');
    observeSessionThreadTitle(session, dependencies);

    emit({
      type: 'om_thread_title_updated',
      cycleId: 'cycle-1',
      threadId: 'thread-1',
      oldTitle: 'Log format parser',
      newTitle: 'Log parser rewrite',
    });

    await vi.waitFor(() =>
      expect(dependencies.sourceControl.sessions.rename).toHaveBeenCalledExactlyOnceWith({
        sessionId: 'resource-1',
        title: 'Log parser rewrite',
      }),
    );
  });

  it('backfills a session row that never saw a rename event, on the next thread bind', async () => {
    const { session, emit } = createSession('Log parser rewrite');
    const dependencies = createDependencies(null);
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_changed', threadId: 'thread-1', previousThreadId: null });

    await vi.waitFor(() =>
      expect(dependencies.sourceControl.sessions.rename).toHaveBeenCalledExactlyOnceWith({
        sessionId: 'resource-1',
        title: 'Log parser rewrite',
      }),
    );
  });

  it('leaves the row alone when the thread has not been named yet', async () => {
    const { session, emit, getById } = createSession();
    const dependencies = createDependencies(null);
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_changed', threadId: 'thread-1', previousThreadId: null });

    await vi.waitFor(() => expect(getById).toHaveBeenCalledOnce());
    expect(dependencies.sourceControl.sessions.getBySessionId).not.toHaveBeenCalled();
    expect(dependencies.sourceControl.sessions.rename).not.toHaveBeenCalled();
  });

  it('leaves the row alone when it already holds the title', async () => {
    const { session, emit } = createSession('Log parser rewrite');
    const dependencies = createDependencies('Log parser rewrite');
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_changed', threadId: 'thread-1', previousThreadId: null });
    emit({ type: 'thread_title_updated', threadId: 'thread-1', title: 'Log parser rewrite' });

    await vi.waitFor(() => expect(dependencies.sourceControl.sessions.getBySessionId).toHaveBeenCalledTimes(2));
    expect(dependencies.sourceControl.sessions.rename).not.toHaveBeenCalled();
  });

  it('skips sessions with no source-control row', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies();
    dependencies.sourceControl.sessions.getBySessionId = vi.fn().mockResolvedValue(null);
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_title_updated', threadId: 'thread-1', title: 'Log parser rewrite' });

    await vi.waitFor(() => expect(dependencies.sourceControl.sessions.getBySessionId).toHaveBeenCalledTimes(1));
    expect(dependencies.sourceControl.sessions.rename).not.toHaveBeenCalled();
  });

  it('warns instead of throwing when the storage write fails', async () => {
    const { session, emit } = createSession();
    const dependencies = createDependencies(null);
    dependencies.sourceControl.sessions.rename = vi.fn().mockRejectedValue(new Error('db down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    observeSessionThreadTitle(session, dependencies);

    emit({ type: 'thread_title_updated', threadId: 'thread-1', title: 'Log parser rewrite' });

    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        '[Factory thread-title mirror] Unable to persist the session title.',
        expect.any(Error),
      ),
    );
    warn.mockRestore();
  });
});
