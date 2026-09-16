import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { FileReadRequiredError } from '../../errors';
import { LocalFilesystem, InMemoryFileReadTracker } from '../../filesystem';
import type { FileReadRecord, FileReadTracker } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

/**
 * Read-tracker lifetime across factory calls (issue #23772).
 *
 * Each agent run calls createWorkspaceTools() anew, so read records must
 * survive factory calls — keyed per memory thread — for suspend/resume and
 * multi-turn conversations to work without forced re-reads.
 */

const EDIT_FILE = WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE;
const READ_FILE = WORKSPACE_TOOLS.FILESYSTEM.READ_FILE;

/** Fully async FileReadTracker — exercises the Promise-returning interface. */
class AsyncFileReadTracker implements FileReadTracker {
  private inner = new InMemoryFileReadTracker();

  async recordRead(path: string, modifiedAt: Date): Promise<void> {
    this.inner.recordRead(path, modifiedAt);
  }
  async getReadRecord(path: string): Promise<FileReadRecord | undefined> {
    return this.inner.getReadRecord(path);
  }
  async needsReRead(path: string, currentModifiedAt: Date): Promise<{ needsReRead: boolean; reason?: string }> {
    return this.inner.needsReRead(path, currentModifiedAt);
  }
  async clearReadRecord(path: string): Promise<void> {
    this.inner.clearReadRecord(path);
  }
  async clear(): Promise<void> {
    this.inner.clear();
  }
}

describe('read-tracker lifetime across createWorkspaceTools calls', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-tracker-lifetime-'));
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'original content');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  function makeWorkspace(extraToolsConfig: Record<string, unknown> = {}) {
    return new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [EDIT_FILE]: { requireReadBeforeWrite: true },
        ...extraToolsConfig,
      },
    });
  }

  describe('per-thread default tracker', () => {
    it('allows write in a later factory call after read in an earlier one (same threadId — suspend/resume repro)', async () => {
      const workspace = makeWorkspace();

      // Run 1: read the file (records the read), then suspend.
      const run1 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // Run 2 (resume): fresh factory call, same thread — write must succeed
      // without a forced re-read.
      const run2 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      const result = await run2[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
        { workspace },
      );
      expect(result).toContain('Replaced 1 occurrence');

      const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
      expect(content).toBe('updated content');
    });

    it('does not leak read records across threads', async () => {
      const workspace = makeWorkspace();

      const threadA = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-a' });
      await threadA[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      const threadB = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-b' });
      await expect(
        threadB[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });

    it('keeps per-run reset behavior when no threadId is provided', async () => {
      const workspace = makeWorkspace();

      const run1 = await createWorkspaceTools(workspace, { workspace });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      const run2 = await createWorkspaceTools(workspace, { workspace });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });

    it('still forces a re-read when the file was externally modified after the earlier read', async () => {
      const workspace = makeWorkspace();

      const run1 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // External modification between runs — mtime staleness must still fire.
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(path.join(tempDir, 'target.txt'), 'externally modified');

      const run2 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'externally modified', new_string: 'updated' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);

      const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
      expect(content).toBe('externally modified');
    });

    it('clears the read record after a successful write, forcing a re-read for the next edit', async () => {
      const workspace = makeWorkspace();

      const run1 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });
      await run1[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'first edit' },
        { workspace },
      );

      // Second edit in the same thread without re-reading — must be rejected.
      const run2 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'first edit', new_string: 'second edit' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });
  });

  describe('injected readTracker (WorkspaceToolsConfig.readTracker)', () => {
    it('uses the injected tracker; records survive factory calls even without a threadId', async () => {
      const readTracker = new InMemoryFileReadTracker();
      const workspace = makeWorkspace({ readTracker });

      const run1 = await createWorkspaceTools(workspace, { workspace });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // Injected tracker holds the record.
      expect(readTracker.getReadRecord('target.txt')).toBeDefined();

      const run2 = await createWorkspaceTools(workspace, { workspace });
      const result = await run2[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
        { workspace },
      );
      expect(result).toContain('Replaced 1 occurrence');

      // Successful write clears the record in the injected tracker.
      expect(readTracker.getReadRecord('target.txt')).toBeUndefined();
    });

    it('takes precedence over the per-thread default tracker', async () => {
      const readTracker = new InMemoryFileReadTracker();
      const workspace = makeWorkspace({ readTracker });

      const run1 = await createWorkspaceTools(workspace, { workspace, threadId: 'thread-1' });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // Record went to the injected tracker, not the workspace's thread tracker.
      expect(readTracker.getReadRecord('target.txt')).toBeDefined();
      expect(await workspace.getReadTracker('thread-1').getReadRecord('target.txt')).toBeUndefined();
    });

    it('supports fully async tracker implementations end-to-end', async () => {
      const readTracker = new AsyncFileReadTracker();
      const workspace = makeWorkspace({ readTracker });

      const tools = await createWorkspaceTools(workspace, { workspace });

      // Unread file must be rejected — proves the async needsReRead result is
      // awaited (a missing await would see a truthy Promise and skip the gate).
      await expect(
        tools[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);

      await tools[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      const run2 = await createWorkspaceTools(workspace, { workspace });
      const result = await run2[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
        { workspace },
      );
      expect(result).toContain('Replaced 1 occurrence');
    });
  });

  describe('Workspace.getReadTracker', () => {
    it('returns the same tracker instance for the same threadId', () => {
      const workspace = makeWorkspace();
      expect(workspace.getReadTracker('thread-1')).toBe(workspace.getReadTracker('thread-1'));
      expect(workspace.getReadTracker('thread-1')).not.toBe(workspace.getReadTracker('thread-2'));
    });

    it('evicts least-recently-used trackers beyond the cap', () => {
      const workspace = makeWorkspace();
      const MAX_READ_TRACKERS = 500; // mirrors the constant in workspace.ts

      const first = workspace.getReadTracker('thread-0');
      for (let i = 1; i < MAX_READ_TRACKERS; i++) {
        workspace.getReadTracker(`thread-${i}`);
      }

      // Refresh thread-0's recency, then push past the cap — the LRU entry
      // (thread-1) is evicted, not thread-0.
      expect(workspace.getReadTracker('thread-0')).toBe(first);
      const overflowTracker = workspace.getReadTracker('thread-overflow');

      expect(workspace.getReadTracker('thread-0')).toBe(first);
      expect(workspace.getReadTracker('thread-overflow')).toBe(overflowTracker);
      // thread-1 was evicted — a fresh tracker is created on next access.
      const thread1Again = workspace.getReadTracker('thread-1');
      expect(thread1Again).toBeDefined();
      expect(thread1Again).not.toBe(first);
    });
  });
});
