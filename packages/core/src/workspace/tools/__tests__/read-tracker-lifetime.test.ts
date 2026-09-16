import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { InMemoryThreadStateStorage } from '../../../storage/domains/thread-state';
import { WORKSPACE_TOOLS } from '../../constants';
import { FileReadRequiredError } from '../../errors';
import { LocalFilesystem, ThreadStateFileReadTracker, WORKSPACE_READS_STATE_TYPE } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

/**
 * Read-tracker lifetime across factory calls (issue #23772).
 *
 * Each agent run calls createWorkspaceTools() anew, so read records must
 * survive factory calls — persisted per thread in the `threadState` storage
 * domain — for suspend/resume and multi-turn conversations to work without
 * forced re-reads. Every run constructs a fresh ThreadStateFileReadTracker,
 * so sharing only the store between runs simulates a process restart
 * (serverless suspend/resume).
 */

const EDIT_FILE = WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE;
const READ_FILE = WORKSPACE_TOOLS.FILESYSTEM.READ_FILE;

/** Thread-state store whose persistence layer is down. */
class FailingThreadStateStorage extends InMemoryThreadStateStorage {
  override async getState(): Promise<never> {
    throw new Error('storage down');
  }
  override async setState(): Promise<never> {
    throw new Error('storage down');
  }
}

describe('read-tracker lifetime across createWorkspaceTools calls (GH-23772)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read-tracker-lifetime-'));
    await fs.writeFile(path.join(tempDir, 'target.txt'), 'original content');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  function makeWorkspace() {
    return new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      tools: {
        [EDIT_FILE]: { requireReadBeforeWrite: true },
      },
    });
  }

  describe('thread-state-backed tracker', () => {
    it('persists read records across separate tracker instances sharing the store (suspend/resume repro)', async () => {
      const workspace = makeWorkspace();
      const store = new InMemoryThreadStateStorage();

      // Run 1: read the file, then suspend. The tracker instance is discarded
      // with the run — only the store survives (as on serverless).
      const run1 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // The record landed in the thread-state slot as JSON-safe ISO strings.
      const state = await store.getState<Record<string, { readAt: string; modifiedAtRead: string }>>({
        threadId: 'thread-1',
        type: WORKSPACE_READS_STATE_TYPE,
      });
      expect(state).toBeDefined();
      expect(state!['target.txt']).toBeDefined();
      expect(Number.isNaN(new Date(state!['target.txt']!.readAt).getTime())).toBe(false);
      expect(Number.isNaN(new Date(state!['target.txt']!.modifiedAtRead).getTime())).toBe(false);

      // Run 2 (resume): fresh factory call AND fresh tracker instance, same
      // store and thread — write must succeed without a forced re-read.
      const run2 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
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
      const store = new InMemoryThreadStateStorage();

      const threadA = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-a', store }),
      });
      await threadA[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      const threadB = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-b', store }),
      });
      await expect(
        threadB[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });

    it('still forces a re-read when the file was externally modified after the earlier read', async () => {
      const workspace = makeWorkspace();
      const store = new InMemoryThreadStateStorage();

      const run1 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });

      // External modification between runs — mtime staleness must still fire.
      await new Promise(resolve => setTimeout(resolve, 50));
      await fs.writeFile(path.join(tempDir, 'target.txt'), 'externally modified');

      const run2 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'externally modified', new_string: 'updated' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);

      const content = await fs.readFile(path.join(tempDir, 'target.txt'), 'utf-8');
      expect(content).toBe('externally modified');
    });

    it('clears the persisted read record after a successful write, forcing a re-read for the next edit', async () => {
      const workspace = makeWorkspace();
      const store = new InMemoryThreadStateStorage();

      const run1 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });
      await run1[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'first edit' },
        { workspace },
      );

      // The write cleared the record in storage too.
      const state = await store.getState<Record<string, unknown>>({
        threadId: 'thread-1',
        type: WORKSPACE_READS_STATE_TYPE,
      });
      expect(state?.['target.txt']).toBeUndefined();

      // Second edit in the same thread without re-reading — must be rejected,
      // even from a fresh tracker instance.
      const run2 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'first edit', new_string: 'second edit' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });
  });

  describe('ThreadStateFileReadTracker unit behavior', () => {
    it('round-trips record dates through the storage slot', async () => {
      const store = new InMemoryThreadStateStorage();
      const modifiedAt = new Date('2026-01-02T03:04:05.678Z');

      const writer = new ThreadStateFileReadTracker({ threadId: 'thread-1', store });
      await writer.recordRead('src/app.ts', modifiedAt);

      const reader = new ThreadStateFileReadTracker({ threadId: 'thread-1', store });
      const record = await reader.getReadRecord('src/app.ts');
      expect(record).toBeDefined();
      expect(record!.modifiedAtRead).toBeInstanceOf(Date);
      expect(record!.modifiedAtRead.getTime()).toBe(modifiedAt.getTime());
      expect(record!.readAt).toBeInstanceOf(Date);

      expect((await reader.needsReRead('src/app.ts', modifiedAt)).needsReRead).toBe(false);
    });

    it('evicts the oldest record beyond the per-thread cap', async () => {
      const store = new InMemoryThreadStateStorage();
      const tracker = new ThreadStateFileReadTracker({ threadId: 'thread-1', store });
      const modifiedAt = new Date();
      const CAP = 200; // mirrors MAX_RECORDS_PER_THREAD in thread-state-read-tracker.ts

      for (let i = 0; i < CAP; i++) {
        await tracker.recordRead(`file-${i}.txt`, modifiedAt);
      }
      await tracker.recordRead('overflow.txt', modifiedAt);

      // Oldest record (first inserted) evicted; the rest survive.
      expect(await tracker.getReadRecord('file-0.txt')).toBeUndefined();
      expect(await tracker.getReadRecord('file-1.txt')).toBeDefined();
      expect(await tracker.getReadRecord('overflow.txt')).toBeDefined();

      const state = await store.getState<Record<string, unknown>>({
        threadId: 'thread-1',
        type: WORKSPACE_READS_STATE_TYPE,
      });
      expect(Object.keys(state!)).toHaveLength(CAP);
    });

    it('ignores malformed stored state and starts empty', async () => {
      const store = new InMemoryThreadStateStorage();
      await store.setState({
        threadId: 'thread-1',
        type: WORKSPACE_READS_STATE_TYPE,
        value: {
          'good.txt': { readAt: new Date().toISOString(), modifiedAtRead: new Date().toISOString() },
          'bad.txt': 42,
          'worse.txt': { readAt: 'not-a-date', modifiedAtRead: 'nope' },
        },
      });

      const tracker = new ThreadStateFileReadTracker({ threadId: 'thread-1', store });
      expect(await tracker.getReadRecord('good.txt')).toBeDefined();
      expect(await tracker.getReadRecord('bad.txt')).toBeUndefined();
      expect(await tracker.getReadRecord('worse.txt')).toBeUndefined();
    });

    it('degrades gracefully to in-instance tracking when the store fails', async () => {
      const workspace = makeWorkspace();
      const store = new FailingThreadStateStorage();

      // Within a single run the in-instance cache keeps behavior correct:
      // read then edit succeeds despite every storage call throwing.
      const run1 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await run1[READ_FILE].execute({ path: 'target.txt' }, { workspace });
      const result = await run1[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
        { workspace },
      );
      expect(result).toContain('Replaced 1 occurrence');

      // Nothing persisted, so a fresh instance behaves per-run (pre-fix semantics).
      await fs.writeFile(path.join(tempDir, 'target.txt'), 'original content');
      const run2 = await createWorkspaceTools(workspace, {
        workspace,
        readTracker: new ThreadStateFileReadTracker({ threadId: 'thread-1', store }),
      });
      await expect(
        run2[EDIT_FILE].execute(
          { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
          { workspace },
        ),
      ).rejects.toThrow(FileReadRequiredError);
    });
  });

  describe('no readTracker in configContext', () => {
    it('keeps per-run reset behavior', async () => {
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

    it('read then write succeeds within the same run', async () => {
      const workspace = makeWorkspace();

      const run = await createWorkspaceTools(workspace, { workspace });
      await run[READ_FILE].execute({ path: 'target.txt' }, { workspace });
      const result = await run[EDIT_FILE].execute(
        { path: 'target.txt', old_string: 'original content', new_string: 'updated content' },
        { workspace },
      );
      expect(result).toContain('Replaced 1 occurrence');
    });
  });
});
