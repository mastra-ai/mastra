import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError, StaleFileError, WorkspaceReadOnlyError } from '../errors';
import type { FileStat, WorkspaceFilesystem } from '../filesystem';
import { ApplyPatchError, applyChunks, parsePatch, patchPaths } from './apply-patch-parser';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { startWorkspaceSpan } from './tracing';

/**
 * Paths a patch writes, used to take write locks and run read-before-write
 * checks before the tool executes. Returns `[]` for a malformed patch so the
 * tool itself can report the parse error.
 */
export function getApplyPatchWritePaths(input: { patch?: unknown }): string[] {
  if (typeof input?.patch !== 'string') return [];
  try {
    return patchPaths(parsePatch(input.patch));
  } catch {
    return [];
  }
}

type PlannedChange =
  | { kind: 'write'; path: string; content: string; original?: string }
  | { kind: 'delete'; path: string; original: string | Buffer };

async function statOrUndefined(filesystem: WorkspaceFilesystem, path: string): Promise<FileStat | undefined> {
  try {
    return await filesystem.stat(path);
  } catch (error) {
    if (error instanceof FileNotFoundError) return undefined;
    throw error;
  }
}

function checkNotStale(path: string, stat: FileStat, expectedMtimes: Record<string, Date> | undefined) {
  const expected = expectedMtimes?.[path];
  if (expected && stat.modifiedAt.getTime() !== expected.getTime()) {
    throw new StaleFileError(path, expected, stat.modifiedAt);
  }
}

async function requireExistingFile(
  filesystem: WorkspaceFilesystem,
  path: string,
  expectedMtimes: Record<string, Date> | undefined,
): Promise<void> {
  const stat = await statOrUndefined(filesystem, path);
  if (!stat) throw new ApplyPatchError(`${path} does not exist`);
  if (stat.type !== 'file') throw new ApplyPatchError(`${path} is a directory, not a file`);
  checkNotStale(path, stat, expectedMtimes);
}

async function requireMissing(filesystem: WorkspaceFilesystem, path: string): Promise<void> {
  if (await statOrUndefined(filesystem, path)) {
    throw new ApplyPatchError(`${path} already exists`);
  }
}

export const applyPatchTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH,
  description: `Create, update, move and delete files in one call by applying a patch. Every change applies, or none do.

Format:
*** Begin Patch
*** Add File: path/to/new-file.ts
+first line of the new file
+second line
*** Update File: path/to/existing.ts
*** Move to: path/to/renamed.ts
@@ optional line near the change, e.g. a function signature
 unchanged context line
-line to remove
+line to add
*** Delete File: path/to/obsolete.ts
*** End Patch

Rules:
- Paths are relative to the workspace root. Each path may appear only once per patch.
- "*** Move to:" is optional and must directly follow "*** Update File:".
- In an update, each line starts with " " (context), "-" (remove) or "+" (add). Include about 3 lines of context around each change so it can be located. Start each further hunk with "@@".
- "*** End of File" after a hunk anchors it to the end of the file.
- Added files must not already exist; updated and deleted files must exist.`,
  outputSchema: z.string(),
  inputSchema: z.object({
    patch: z.string().describe('The full patch text, from "*** Begin Patch" to "*** End Patch"'),
  }),
  execute: async ({ patch }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'applyPatch',
      input: { patchLength: patch.length },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      if (filesystem.readOnly) {
        throw new WorkspaceReadOnlyError('apply_patch');
      }

      const expectedMtimes: Record<string, Date> | undefined = (context as any)?.__expectedMtimes;
      const summary: string[] = [];
      const changes: PlannedChange[] = [];

      // Phase 1: validate every operation and compute new contents in memory.
      // Nothing is written until the whole patch is known to apply.
      try {
        const operations = parsePatch(patch);
        for (const op of operations) {
          if (op.type === 'add') {
            await requireMissing(filesystem, op.path);
            changes.push({ kind: 'write', path: op.path, content: op.content });
            summary.push(`A ${op.path}`);
          } else if (op.type === 'delete') {
            await requireExistingFile(filesystem, op.path, expectedMtimes);
            changes.push({ kind: 'delete', path: op.path, original: await filesystem.readFile(op.path) });
            summary.push(`D ${op.path}`);
          } else {
            await requireExistingFile(filesystem, op.path, expectedMtimes);
            const original = await filesystem.readFile(op.path, { encoding: 'utf-8' });
            if (typeof original !== 'string') {
              throw new ApplyPatchError(`${op.path} is a binary file and cannot be patched`);
            }
            const updated = applyChunks(original, op.chunks, op.path);
            if (op.moveTo && op.moveTo !== op.path) {
              await requireMissing(filesystem, op.moveTo);
              changes.push({ kind: 'write', path: op.moveTo, content: updated });
              changes.push({ kind: 'delete', path: op.path, original });
              summary.push(`R ${op.path} -> ${op.moveTo}`);
            } else {
              changes.push({ kind: 'write', path: op.path, content: updated, original });
              summary.push(`M ${op.path}`);
            }
          }
        }
      } catch (error) {
        if (error instanceof ApplyPatchError) {
          span.end({ success: false });
          return `Patch not applied, no files were changed: ${error.message}`;
        }
        throw error;
      }

      // Phase 2: commit. Writes go first so a move never loses its source
      // before the destination exists. On failure, undo what was done.
      const ordered = [...changes.filter(c => c.kind === 'write'), ...changes.filter(c => c.kind === 'delete')];
      const done: PlannedChange[] = [];
      try {
        for (const change of ordered) {
          if (change.kind === 'write') {
            await filesystem.writeFile(change.path, change.content, {
              overwrite: change.original !== undefined,
              expectedMtime: change.original !== undefined ? expectedMtimes?.[change.path] : undefined,
            });
          } else {
            await filesystem.deleteFile(change.path);
          }
          done.push(change);
        }
      } catch (error) {
        const rollbackFailures = await rollback(filesystem, done);
        if (rollbackFailures.length > 0) {
          throw new Error(
            `apply_patch failed while writing (${(error as Error).message}) and could not restore: ${rollbackFailures.join(', ')}`,
            { cause: error },
          );
        }
        throw error;
      }

      span.end({ success: true });
      return `Applied patch:\n${summary.join('\n')}`;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});

/** Revert committed changes in reverse order. Returns the paths that could not be restored. */
async function rollback(filesystem: WorkspaceFilesystem, done: PlannedChange[]): Promise<string[]> {
  const failures: string[] = [];
  for (const change of [...done].reverse()) {
    try {
      if (change.kind === 'delete') {
        await filesystem.writeFile(change.path, change.original);
      } else if (change.original !== undefined) {
        await filesystem.writeFile(change.path, change.original);
      } else {
        await filesystem.deleteFile(change.path);
      }
    } catch {
      failures.push(change.path);
    }
  }
  return failures;
}
