import type { SessionBeforeAgentEndListener } from '@mastra/core/agent-controller';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __clearSessionSandboxesForTests, getSessionSandbox } from '../sandbox/session-sandbox.js';
import { __clearSessionEnvironmentsForTests, recordSessionEnvironment } from './environment-state-processor.js';
import type { SessionEnvironmentRepositoryState } from './environment-state-processor.js';
import {
  captureSessionFilesystem,
  observeSessionFilesystem,
  parseFilesystemCaptureFiles,
  waitForPendingFilesystemCapture,
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

function createSession(results = [commandResult(), commandResult()], resourceId = 'resource-1') {
  const executeCommand = vi.fn(async () => results.shift() ?? commandResult());
  const listeners: SessionBeforeAgentEndListener[] = [];
  const eventListeners: Array<(event: unknown) => void> = [];
  const session: FilesystemCaptureSession = {
    identity: { getResourceId: () => resourceId },
    thread: { requireId: () => 'thread-1' },
    getWorkspace: () => ({
      sandbox: {
        id: 'sandbox-1',
        name: 'Test sandbox',
        provider: 'test',
        executeCommand,
      },
    }),
    onBeforeAgentEnd: listener => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
    subscribe: listener => {
      eventListeners.push(listener as (event: unknown) => void);
      return () => {
        const index = eventListeners.indexOf(listener as (event: unknown) => void);
        if (index !== -1) eventListeners.splice(index, 1);
      };
    },
  };

  const emit = (event: unknown) => {
    for (const listener of [...eventListeners]) listener(event);
  };
  /**
   * Mark the current turn as having touched the workspace: a successful
   * `execute_command` tool call, which is what gates capture.
   */
  const touchWorkspace = (toolCallId = `tool-${Math.random().toString(36).slice(2)}`) => {
    emit({ type: 'tool_start', toolCallId, toolName: 'execute_command' });
    emit({ type: 'tool_end', toolCallId, isError: false });
  };

  return { session, executeCommand, listeners, emit, touchWorkspace };
}

/**
 * Seed the per-process memo with a live sandbox whose derived workdir is
 * `/worktree` (local provider: `<workingDirectory>/<repo name>`). Capture
 * reads the workdir from the memo ONLY — the persisted column is
 * observability, never a decision input.
 */
function seedLiveWorkdir(sessionRowId = 'source-session-1', status = 'running') {
  getSessionSandbox(
    sessionRowId,
    'seed/worktree',
    () => ({ id: 'sb-live', provider: 'local', status, workingDirectory: '/sessions/s1' }) as never,
  );
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
          sandboxWorkdir: '/sessions/s1/worktree',
          materializedAt: new Date(),
          createdAt: SESSION_CREATED_AT,
          updatedAt: new Date(),
        }),
      },
    },
  };
}

const SESSION_CREATED_AT = new Date('2026-10-09T17:00:00.000Z');

describe('parseFilesystemCaptureFiles', () => {
  it('treats command output as plain paths and normalizes a leading dot segment', () => {
    expect(parseFilesystemCaptureFiles('src/app.ts\0./notes/todo.md\0ab file.ts\0src/app.ts\0')).toEqual([
      { path: 'ab file.ts' },
      { path: 'notes/todo.md' },
      { path: 'src/app.ts' },
    ]);
  });
});

describe('captureSessionFilesystem', () => {
  beforeEach(() => {
    __clearSessionSandboxesForTests();
    seedLiveWorkdir();
  });

  it('skips capture when only the persisted workdir column exists (never a decision input)', async () => {
    // The stale-workdir incident class: a row written under a previous
    // provider points at a path that no longer exists. With no live memo
    // entry there is nothing trustworthy to capture against.
    __clearSessionSandboxesForTests();
    const { session, executeCommand } = createSession([]);
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(executeCommand).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });

  it('skips capture when the memoized sandbox is not running (telemetry never boots a VM)', async () => {
    // executeCommand lazily starts the sandbox via ensureRunning — a
    // chat-only turn whose sandbox was constructed but never started must
    // not have a VM provisioned just to read an empty git status.
    __clearSessionSandboxesForTests();
    seedLiveWorkdir('source-session-1', 'pending');
    const { session, executeCommand } = createSession([]);
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(executeCommand).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });

  it('captures Git changes and ignored workspace artifacts', async () => {
    const { session, executeCommand } = createSession([
      commandResult({ stdout: 'src/app.ts\0new.txt\0' }),
      commandResult({ stdout: './.artifacts/hello-world.md\0' }),
    ]);
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(executeCommand).toHaveBeenNthCalledWith(
      1,
      'sh',
      [
        '-c',
        expect.stringContaining('diff --name-only -z --find-renames'),
        'mastracode-changed-files',
        '/sessions/s1/worktree',
        'main',
      ],
      { timeout: 30_000 },
    );
    expect(executeCommand).toHaveBeenNthCalledWith(
      2,
      'sh',
      ['-c', 'cd "$1" && test -d .artifacts && find .artifacts -type f -print0 || true', 'sh', '/sessions/s1/worktree'],
      { timeout: 30_000 },
    );
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: '.artifacts/hello-world.md' }, { path: 'new.txt' }, { path: 'src/app.ts' }],
    });
    // One checkout: git and artifacts only, the root is the checkout itself.
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });

  it('clears persisted files after successful empty Git and artifact listings', async () => {
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

    const failed = createSession([commandResult({ exitCode: 1, stderr: 'not a repository' })]);
    const failedDependencies = createDependencies();
    await captureSessionFilesystem(failed.session, failedDependencies);

    expect(failedDependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      '[Factory filesystem capture] Unable to inspect Git changes.',
      'not a repository',
    );
    error.mockRestore();
  });
});

describe('captureSessionFilesystem across environment repositories', () => {
  const slugs = ['acme/api', 'acme/docs', 'acme/site'];
  const dirs: Record<string, string> = {
    'acme/api': '/sessions/s1/api',
    'acme/docs': '/sessions/s1/docs',
    'acme/site': '/sessions/s1/site',
  };
  const state = (slug: string): SessionEnvironmentRepositoryState => ({
    slug,
    dir: dirs[slug]!,
    branch: slug === 'acme/api' ? 'session-branch' : 'develop',
    defaultBranch: 'develop',
    position: slugs.indexOf(slug) + 1,
    setupStatus: 'ok',
  });

  /** Seed the memo with a three-repository layout rooted at `/sessions/s1`, own repository `acme/api`. */
  function seedEnvironment(recorded = slugs) {
    __clearSessionSandboxesForTests();
    __clearSessionEnvironmentsForTests();
    getSessionSandbox(
      'source-session-1',
      'acme/api',
      () => ({ id: 'sb-live', provider: 'local', status: 'running', workingDirectory: '/sessions/s1' }) as never,
      slugs,
    );
    recordSessionEnvironment('resource-1', { workingDirectory: '/sessions/s1', repositories: recorded.map(state) }, []);
  }

  /** A session whose executeCommand answers by the checkout directory it was asked about. */
  function createEnvironmentSession(
    answers: Record<string, ReturnType<typeof commandResult>>,
    artifacts = commandResult(),
    rootFiles = commandResult(),
  ) {
    const executeCommand = vi.fn(async (_command: string, args: string[]) => {
      if (args[1] === 'cd "$1" && test -d .artifacts && find .artifacts -type f -print0 || true') return artifacts;
      if (args[1].includes('-newer "$ref"')) return rootFiles;
      return answers[args[3]!] ?? commandResult();
    });
    const base = createSession([]);
    const session: FilesystemCaptureSession = {
      ...base.session,
      getWorkspace: () => ({ sandbox: { id: 'sandbox-1', name: 'Test sandbox', provider: 'test', executeCommand } }),
    };
    return { session, executeCommand };
  }

  afterEach(() => {
    __clearSessionEnvironmentsForTests();
    vi.restoreAllMocks();
  });

  it('runs one git pass per checkout against its own base branch and prefixes the paths', async () => {
    seedEnvironment();
    const { session, executeCommand } = createEnvironmentSession(
      {
        '/sessions/s1/api': commandResult({ stdout: 'src/app.ts\0' }),
        '/sessions/s1/docs': commandResult({ stdout: 'README.md\0' }),
        '/sessions/s1/site': commandResult({ stdout: 'index.html\0' }),
      },
      commandResult({ stdout: './.artifacts/report.md\0' }),
      commandResult({ stdout: './poem.txt\0./.setup-ran-workdir\0' }),
    );
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    const gitCalls = executeCommand.mock.calls.filter(call => call[1][2] === 'mastracode-changed-files');
    expect(gitCalls.map(call => [call[1][3], call[1][4]])).toEqual([
      ['/sessions/s1/api', 'main'],
      ['/sessions/s1/docs', 'develop'],
      ['/sessions/s1/site', 'develop'],
    ]);
    // Artifacts, then the root-level files written since the session was created, both at the root.
    const rootCalls = executeCommand.mock.calls.filter(call => call[1][2] === 'sh');
    expect(rootCalls.map(call => call[1][3])).toEqual(['/sessions/s1', '/sessions/s1']);
    expect(rootCalls[1]![1][4]).toBe('202610091700.00');
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [
        { path: '.artifacts/report.md' },
        { path: '.setup-ran-workdir' },
        { path: 'api/src/app.ts' },
        { path: 'docs/README.md' },
        { path: 'poem.txt' },
        { path: 'site/index.html' },
      ],
    });
  });

  it('keeps the git and artifact results when the root listing fails', async () => {
    seedEnvironment();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { session } = createEnvironmentSession(
      { '/sessions/s1/api': commandResult({ stdout: 'src/app.ts\0' }) },
      commandResult({ stdout: './.artifacts/report.md\0' }),
      commandResult({ exitCode: 1, stderr: 'find: not permitted' }),
    );
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    expect(warn).toHaveBeenCalledWith(
      '[Factory filesystem capture] Unable to list workspace root files.',
      'find: not permitted',
    );
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: '.artifacts/report.md' }, { path: 'api/src/app.ts' }],
    });
  });

  it('compares a repository the boot has not recorded yet against its own HEAD', async () => {
    seedEnvironment(['acme/api', 'acme/site']);
    const { session, executeCommand } = createEnvironmentSession({
      '/sessions/s1/api': commandResult({ stdout: 'a.ts\0' }),
      '/sessions/s1/docs': commandResult({ stdout: 'c.ts\0' }),
      '/sessions/s1/site': commandResult({ stdout: 'b.ts\0' }),
    });
    const dependencies = createDependencies();

    await captureSessionFilesystem(session, dependencies);

    const gitTargets = executeCommand.mock.calls
      .filter(call => call[1][2] === 'mastracode-changed-files')
      .map(call => [call[1][3], call[1][4]]);
    expect(gitTargets).toEqual([
      ['/sessions/s1/api', 'main'],
      ['/sessions/s1/docs', 'HEAD'],
      ['/sessions/s1/site', 'develop'],
    ]);
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'api/a.ts' }, { path: 'docs/c.ts' }, { path: 'site/b.ts' }],
    });
  });

  it('skips a repository whose checkout is missing (exit 3) and writes the others', async () => {
    seedEnvironment();
    const { session } = createEnvironmentSession({
      '/sessions/s1/api': commandResult({ stdout: 'a.ts\0' }),
      '/sessions/s1/docs': commandResult({ exitCode: 3 }),
      '/sessions/s1/site': commandResult({ stdout: 'b.ts\0' }),
    });
    const dependencies = createDependencies();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await captureSessionFilesystem(session, dependencies);

    expect(warn).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'api/a.ts' }, { path: 'site/b.ts' }],
    });
  });

  it('a transient failure in any repository leaves the previous listing in place', async () => {
    seedEnvironment();
    const { session } = createEnvironmentSession({
      '/sessions/s1/api': commandResult({ stdout: 'a.ts\0' }),
      '/sessions/s1/docs': commandResult({ exitCode: 1, stderr: 'fatal: index locked' }),
    });
    const dependencies = createDependencies();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await captureSessionFilesystem(session, dependencies);

    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[Factory filesystem capture] Unable to inspect Git changes.',
      'fatal: index locked',
    );
  });
});

describe('observeSessionFilesystem', () => {
  beforeEach(() => {
    __clearSessionSandboxesForTests();
    seedLiveWorkdir();
  });

  it.each(['complete', 'aborted', 'error', 'suspended'] as const)(
    'captures before %s agent-end events',
    async reason => {
      const { session, listeners, touchWorkspace } = createSession();
      const dependencies = createDependencies();
      observeSessionFilesystem(session, dependencies);

      // The listener no longer returns the capture chain; the capture still
      // runs and persists in the background.
      touchWorkspace();
      listeners[0]!({ type: 'agent_end', reason });

      await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));
    },
  );

  it('skips capture on turns that never touched the workspace (never wakes an idle sandbox)', async () => {
    // A pure-chat turn has no workspace tool call: capture must not run at
    // all, because its executeCommand would resume an idle VM just to read
    // an unchanged listing.
    const { session, executeCommand, listeners } = createSession();
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    await Promise.resolve();

    expect(executeCommand).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });

  it('non-workspace, failed, and denied tool calls do not count as touching the workspace', async () => {
    const { session, executeCommand, listeners, emit } = createSession();
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    // Non-workspace tool.
    emit({ type: 'tool_start', toolCallId: 't1', toolName: 'notification_inbox' });
    emit({ type: 'tool_end', toolCallId: 't1', isError: false });
    // Workspace tool that failed.
    emit({ type: 'tool_start', toolCallId: 't2', toolName: 'execute_command' });
    emit({ type: 'tool_end', toolCallId: 't2', isError: true });
    // Workspace tool that was denied.
    emit({ type: 'tool_start', toolCallId: 't3', toolName: 'write_file' });
    emit({ type: 'tool_end', toolCallId: 't3', isError: false, denied: true });
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    await Promise.resolve();

    expect(executeCommand).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });

  it('the workspace-touched flag resets each turn', async () => {
    const { session, listeners, emit, touchWorkspace } = createSession([
      commandResult(),
      commandResult(),
      commandResult(),
      commandResult(),
    ]);
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    // Turn 1 touches the workspace: capture runs.
    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    emit({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));

    // Turn 2 is pure chat: the previous turn's touch must not leak forward.
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    await Promise.resolve();
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1);
  });

  it('persists a queued capture after the session thread is cleared by deleteSession', async () => {
    // Regression for #24893: deleteSession clears the thread before the
    // queued capture runs; the capture must use the thread read at schedule time.
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-deleted-thread');
    let threadId: string | null = 'thread-1';
    session.thread.requireId = () => {
      if (!threadId) throw new Error('No active thread on this session');
      return threadId;
    };
    const dependencies = createDependencies();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    threadId = null;
    await waitForPendingFilesystemCapture('resource-deleted-thread');

    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'resource-deleted-thread', threadId: 'thread-1' }),
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not gate the agent-end listener on slow capture execs', async () => {
    // The sandbox exec never resolves: the listener must still settle
    // immediately, because agent_end must not wait on the capture I/O.
    // Unique resource id: this chain never settles and must not leak into
    // other tests through the shared resource-level chain map.
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-never-settles');
    const gatedExec = new Promise<never>(() => {});
    session.getWorkspace = () => ({
      sandbox: { executeCommand: vi.fn(() => gatedExec) } as any,
    });
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    const listenerResult = listeners[0]!({ type: 'agent_end', reason: 'complete' });

    // Resolves without waiting on the never-resolving exec.
    await expect(Promise.resolve(listenerResult)).resolves.toBeUndefined();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();
  });

  it('still persists the capture after the listener returns', async () => {
    // Gate the exec, release it after the listener has already settled, and
    // verify the capture completes in the background.
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-background-persist');
    let releaseExec: ((value: ReturnType<typeof commandResult>) => void) | undefined;
    const gate = new Promise<ReturnType<typeof commandResult>>(resolve => {
      releaseExec = resolve;
    });
    const executeCommand = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockImplementation(async () => commandResult());
    session.getWorkspace = () => ({ sandbox: { executeCommand } as any });
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(executeCommand).toHaveBeenCalledTimes(1));
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();

    releaseExec?.(commandResult());
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));
  });

  it('serializes captures when terminal events arrive before the prior capture finishes', async () => {
    const { session, listeners, touchWorkspace } = createSession(
      [commandResult(), commandResult(), commandResult(), commandResult()],
      'resource-serialize',
    );
    let completeFirstCapture: (() => void) | undefined;
    const dependencies = createDependencies();
    dependencies.filesystem.replaceFiles = vi.fn(
      () =>
        new Promise<void>(resolve => {
          completeFirstCapture = resolve;
        }),
    );
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await Promise.resolve();
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1);

    completeFirstCapture?.();
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(2));
    completeFirstCapture?.();
  });

  it('serializes captures across sessions observing the same resource', async () => {
    // Sessions are deduplicated by (resourceId, scope), so two scoped
    // sessions can observe the same resource; their captures must extend one
    // shared chain instead of interleaving through independent ones.
    const first = createSession(undefined, 'resource-shared');
    const second = createSession(undefined, 'resource-shared');
    let releaseExec: ((value: ReturnType<typeof commandResult>) => void) | undefined;
    const gate = new Promise<ReturnType<typeof commandResult>>(resolve => {
      releaseExec = resolve;
    });
    const firstExec = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockImplementation(async () => commandResult());
    first.session.getWorkspace = () => ({ sandbox: { executeCommand: firstExec } as any });
    const dependencies = createDependencies();
    observeSessionFilesystem(first.session, dependencies);
    observeSessionFilesystem(second.session, dependencies);

    first.touchWorkspace();
    first.listeners[0]!({ type: 'agent_end', reason: 'complete' });
    second.touchWorkspace();
    second.listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(firstExec).toHaveBeenCalledTimes(1));

    // The second session's capture waits on the first session's gated exec.
    expect(second.executeCommand).not.toHaveBeenCalled();
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();

    releaseExec?.(commandResult());
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(2));
    expect(second.executeCommand).toHaveBeenCalled();
  });

  it('disposing the listener does not cancel an in-flight capture', async () => {
    // A final-turn capture may still be running when the session tears the
    // listener down; the chain must run to completion and persist.
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-dispose');
    let releaseExec: ((value: ReturnType<typeof commandResult>) => void) | undefined;
    const gate = new Promise<ReturnType<typeof commandResult>>(resolve => {
      releaseExec = resolve;
    });
    const executeCommand = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockImplementation(async () => commandResult());
    session.getWorkspace = () => ({ sandbox: { executeCommand } as any });
    const dependencies = createDependencies();
    const dispose = observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(executeCommand).toHaveBeenCalledTimes(1));

    dispose();
    expect(listeners).toHaveLength(0);

    releaseExec?.(commandResult());
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));
  });
});

describe('waitForPendingFilesystemCapture', () => {
  it('resolves immediately when the session has no capture in flight', async () => {
    await expect(waitForPendingFilesystemCapture('no-such-resource')).resolves.toBeUndefined();
  });

  it('a reader awaiting the pending capture observes the persisted listing (agent_end contract)', async () => {
    // The contract this module alters: agent_end no longer waits on the
    // capture, so a reader refetching at agent_end must await the pending
    // capture to see this turn's listing rather than the previous one.
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-wait-fresh');
    let releaseExec: ((value: ReturnType<typeof commandResult>) => void) | undefined;
    const gate = new Promise<ReturnType<typeof commandResult>>(resolve => {
      releaseExec = resolve;
    });
    const executeCommand = vi
      .fn()
      .mockImplementationOnce(() => gate)
      .mockImplementation(async () => commandResult());
    session.getWorkspace = () => ({ sandbox: { executeCommand } as any });
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(executeCommand).toHaveBeenCalledTimes(1));

    let waitSettled = false;
    const wait = waitForPendingFilesystemCapture('resource-wait-fresh').then(() => {
      waitSettled = true;
    });
    await Promise.resolve();
    expect(waitSettled).toBe(false);
    expect(dependencies.filesystem.replaceFiles).not.toHaveBeenCalled();

    releaseExec?.(commandResult());
    await wait;
    // The persist happened before the reader's wait resolved.
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting for a capture chained by a turn that ends during the wait', async () => {
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-wait-successor');
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let releaseSecond: (() => void) | undefined;
    const secondGate = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    const dependencies = createDependencies();
    // Execs of the first capture wait on firstGate; once it has persisted,
    // the successor capture's execs wait on secondGate.
    const executeCommand = vi.fn(async () => {
      const firstPersisted = vi.mocked(dependencies.filesystem.replaceFiles).mock.calls.length > 0;
      await (firstPersisted ? secondGate : firstGate);
      return commandResult();
    });
    session.getWorkspace = () => ({ sandbox: { executeCommand } as any });
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });
    await vi.waitFor(() => expect(executeCommand).toHaveBeenCalledTimes(1));

    let waitSettled = false;
    const wait = waitForPendingFilesystemCapture('resource-wait-successor').then(() => {
      waitSettled = true;
    });

    // Another turn ends while the first capture is still running.
    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });

    releaseFirst?.();
    await vi.waitFor(() => expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(waitSettled).toBe(false);

    releaseSecond?.();
    await wait;
    expect(dependencies.filesystem.replaceFiles).toHaveBeenCalledTimes(2);
  });

  it('bounds the wait so a stuck capture cannot block readers', async () => {
    const { session, listeners, touchWorkspace } = createSession(undefined, 'resource-wait-stuck');
    session.getWorkspace = () => ({
      sandbox: { executeCommand: vi.fn(() => new Promise<never>(() => {})) } as any,
    });
    const dependencies = createDependencies();
    observeSessionFilesystem(session, dependencies);

    touchWorkspace();
    listeners[0]!({ type: 'agent_end', reason: 'complete' });

    await expect(waitForPendingFilesystemCapture('resource-wait-stuck', 20)).resolves.toBeUndefined();
  });
});
