import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { FileReadRequiredError } from '../../errors';
import { InMemoryFileReadTracker, LocalFilesystem } from '../../filesystem';
import type { FileReadTracker } from '../../filesystem';
import { Workspace } from '../../workspace';
import type { FileReadTrackerScope } from '../../workspace';
import { createWorkspaceTools } from '../tools';

describe('createWorkspaceTools — fileReadTracker injection', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-tracker-injection-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('uses an injected tracker instance instead of a fresh in-memory one', async () => {
    const injected = new InMemoryFileReadTracker();
    const recordSpy = vi.spyOn(injected, 'recordRead');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      fileReadTracker: injected,
    });
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'hello');

    const tools = await createWorkspaceTools(workspace);
    await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'a.txt' }, { workspace });

    expect(recordSpy).toHaveBeenCalledWith('a.txt', expect.any(Date));
    expect(injected.getReadRecord('a.txt')).toBeDefined();
  });

  it('calls a tracker factory with the run scope', async () => {
    const factory = vi.fn((_scope: FileReadTrackerScope) => new InMemoryFileReadTracker());
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      fileReadTracker: factory,
    });

    await createWorkspaceTools(workspace, undefined, {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      runId: 'run-1',
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory.mock.calls[0][0]).toMatchObject({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      runId: 'run-1',
    });
  });

  it('falls back to an in-memory tracker when the factory throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      fileReadTracker: () => {
        throw new Error('boom');
      },
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      },
    });
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'hello');

    const tools = await createWorkspaceTools(workspace);
    // Tools still build and enforce read-before-write with the fallback tracker.
    await expect(
      tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute({ path: 'a.txt', content: 'x' }, { workspace }),
    ).rejects.toThrow(FileReadRequiredError);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('awaits an asynchronous tracker implementation', async () => {
    const backing = new InMemoryFileReadTracker();
    const asyncTracker: FileReadTracker = {
      recordRead: async (p, m) => backing.recordRead(p, m),
      getReadRecord: async p => backing.getReadRecord(p),
      needsReRead: async (p, m) => backing.needsReRead(p, m),
      clearReadRecord: async p => backing.clearReadRecord(p),
      clear: async () => backing.clear(),
    };

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      fileReadTracker: asyncTracker,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireReadBeforeWrite: true },
      },
    });
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'hello');

    const tools = await createWorkspaceTools(workspace);

    // Not read yet → async needsReRead resolves to true → rejected.
    await expect(
      tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute({ path: 'a.txt', content: 'x' }, { workspace }),
    ).rejects.toThrow(FileReadRequiredError);

    // Read (async recordRead awaited) then write succeeds.
    await tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'a.txt' }, { workspace });
    const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE].execute(
      { path: 'a.txt', content: 'updated' },
      { workspace },
    );
    expect(result).toContain('Wrote');
  });

  it('persists read records across a simulated suspend/resume via a shared per-thread tracker', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'original');

    // A persistent store keyed by threadId, surviving createWorkspaceTools calls.
    const store = new Map<string, FileReadTracker>();
    const factory = (scope: FileReadTrackerScope) => {
      const key = scope.threadId ?? 'default';
      let tracker = store.get(key);
      if (!tracker) {
        tracker = new InMemoryFileReadTracker();
        store.set(key, tracker);
      }
      return tracker;
    };

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      fileReadTracker: factory,
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireReadBeforeWrite: true },
      },
    });

    // Run 1: read the file, then the run "suspends".
    const toolsBeforeSuspend = await createWorkspaceTools(workspace, undefined, { threadId: 'thread-1' });
    await toolsBeforeSuspend[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'a.txt' }, { workspace });

    // Run 2 (resume): fresh tool set, same threadId → same persistent tracker.
    const toolsAfterResume = await createWorkspaceTools(workspace, undefined, { threadId: 'thread-1' });
    const result = await toolsAfterResume[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute(
      { path: 'a.txt', old_string: 'original', new_string: 'edited' },
      { workspace },
    );
    expect(result).toBeDefined();
    const content = await fs.readFile(path.join(tempDir, 'a.txt'), 'utf-8');
    expect(content).toContain('edited');
  });

  it('control: with the default in-memory tracker, a resumed run is rejected until re-read', async () => {
    await fs.writeFile(path.join(tempDir, 'a.txt'), 'original');

    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireReadBeforeWrite: true },
      },
    });

    const toolsBeforeSuspend = await createWorkspaceTools(workspace, undefined, { threadId: 'thread-1' });
    await toolsBeforeSuspend[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE].execute({ path: 'a.txt' }, { workspace });

    const toolsAfterResume = await createWorkspaceTools(workspace, undefined, { threadId: 'thread-1' });
    await expect(
      toolsAfterResume[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE].execute(
        { path: 'a.txt', old_string: 'original', new_string: 'edited' },
        { workspace },
      ),
    ).rejects.toThrow(FileReadRequiredError);
  });
});
