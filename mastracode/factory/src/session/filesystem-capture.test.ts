import type { AgentControllerEventListener } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import {
  captureSessionFilesystem,
  observeSessionFilesystem,
  parseFilesystemCaptureFiles,
  type FilesystemCaptureDependencies,
  type FilesystemCaptureSession,
} from './filesystem-capture.js';

function commandResult(overrides: Partial<{ exitCode: number; stdout: string; stderr: string }> = {}) {
  return {
    success: (overrides.exitCode ?? 0) === 0,
    exitCode: 0,
    stdout: '',
    stderr: '',
    executionTimeMs: 1,
    ...overrides,
  };
}

function createSession(result = commandResult()) {
  const executeCommand = vi.fn().mockResolvedValue(result);
  const listeners: AgentControllerEventListener[] = [];
  const session: FilesystemCaptureSession = {
    identity: { getResourceId: () => 'resource-1' },
    thread: { requireId: () => 'thread-1' },
    getWorkspace: () => ({
      sandbox: {
        id: 'sandbox-1',
        name: 'Test sandbox',
        provider: 'test',
        executeCommand,
      },
    }),
    subscribe: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };

  return { session, executeCommand, listeners };
}

function createDependencies(): FilesystemCaptureDependencies {
  return {
    filesystem: { replaceFiles: vi.fn().mockResolvedValue(undefined) },
    sourceControl: {
      sessions: {
        getBySessionId: vi.fn().mockResolvedValue({
          id: 'source-session-1',
          sessionId: 'resource-1',
          projectRepositoryId: 'project-repository-1',
          orgId: 'org-1',
          userId: 'user-1',
          branch: 'main',
          baseBranch: 'main',
          sandboxId: 'sandbox-1',
          sandboxWorkdir: '/worktree',
          materializedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    },
  };
}

describe('parseFilesystemCaptureFiles', () => {
  it('keeps current on-disk paths and omits deleted paths', () => {
    expect(
      parseFilesystemCaptureFiles(
        ' M src/app.ts\0?? notes/todo.md\0R  src/renamed.ts\0src/old.ts\0C  copy.ts\0source.ts\0 D removed.ts\0DD gone.ts\0UU conflict.ts\0',
      ),
    ).toEqual([
      { path: 'conflict.ts', filename: 'conflict.ts' },
      { path: 'copy.ts', filename: 'copy.ts' },
      { path: 'notes/todo.md', filename: 'todo.md' },
      { path: 'src/app.ts', filename: 'app.ts' },
      { path: 'src/renamed.ts', filename: 'renamed.ts' },
    ]);
  });
});

describe('captureSessionFilesystem', () => {
  it('captures Git status with the source-control workdir and replaces persisted files', async () => {
    const { session, executeCommand } = createSession(commandResult({ stdout: ' M src/app.ts\0?? new.txt\0' }));
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(executeCommand).toHaveBeenCalledWith(
      'git',
      ['-C', '/worktree', 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
      { timeout: 30_000 },
    );
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [
        { path: 'new.txt', filename: 'new.txt' },
        { path: 'src/app.ts', filename: 'app.ts' },
      ],
    });
  });

  it('clears persisted files after a successful empty Git status', async () => {
    const { session } = createSession();
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [],
    });
  });

  it('preserves persisted files when the source workspace is unavailable or Git fails', async () => {
    const unavailable = createSession();
    const unavailableDependencies = createDependencies();
    unavailableDependencies.sourceControl.sessions.getBySessionId = vi.fn().mockResolvedValue(null);
    const error = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await captureSessionFilesystem(unavailable.session, unavailableDependencies);

    expect(unavailable.executeCommand).not.toHaveBeenCalled();
    expect(unavailableDependencies.filesystem.replaceFiles).not.toHaveBeenCalled();

    const failed = createSession(commandResult({ exitCode: 1, stderr: 'not a repository' }));
    const failedDependencies = createDependencies();
    await captureSessionFilesystem(failed.session, failedDependencies);

    expect(failedDependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      '[Factory filesystem capture] Unable to inspect Git status.',
      'not a repository',
    );
    error.mockRestore();
  });
});

describe('observeSessionFilesystem', () => {
  it.each(['complete', 'aborted', 'error', 'suspended'] as const)('captures on %s agent-end events', async reason => {
    const { session, listeners } = createSession();
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    listeners[0]!({ type: 'agent_end', reason });

    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));
  });

  it('ignores non-terminal events', async () => {
    const { session, listeners } = createSession();
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    listeners[0]!({ type: 'workspace_status_changed', status: 'ready' });
    await Promise.resolve();

    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });
});
