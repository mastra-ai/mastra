import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { FileExistsError, FileNotFoundError, WorkspaceReadOnlyError } from '../errors';
import { applyChunks, ApplyPatchHunkError, ApplyPatchParseError, parseApplyPatch } from './apply-patch-parser';
import type { PatchHunk } from './apply-patch-parser';
import { emitWorkspaceMetadata, getEditDiagnosticsText, requireFilesystem } from './helpers';
import { startWorkspaceSpan } from './tracing';

type PlannedChange =
  | { action: 'add'; path: string; content: string }
  | { action: 'update'; path: string; content: string }
  | { action: 'move'; from: string; to: string; content: string }
  | { action: 'delete'; path: string };

function expectedMtimeFor(context: unknown, path: string): Date | undefined {
  const ctx = context as { __expectedMtimes?: Record<string, Date>; __expectedMtime?: Date } | undefined;
  return ctx?.__expectedMtimes?.[path] ?? ctx?.__expectedMtime;
}

export const applyPatchTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH,
  description: `Apply a multi-file patch to the workspace filesystem.

Use this when one change set should create, update, move, or delete several files. Prefer edit_file for a single unique string replacement and write_file to create or overwrite one file.

The patch language:

*** Begin Patch
*** Add File: src/new.ts
+export const x = 1
*** Update File: src/existing.ts
@@
 context line
-old
+new
*** Move to: src/renamed.ts
*** Delete File: src/obsolete.ts
*** End Patch

Rules:
- Wrap the entire change set in *** Begin Patch / *** End Patch.
- Prefix every new line with + even when adding a file.
- Update hunks use space (context), - (remove), and + (add). Include enough context so the hunk is unique. Use @@ headers to disambiguate repeated snippets.
- Paths are workspace-relative, never absolute.
- Read files you are updating before patching them.`,
  inputSchema: z.object({
    patchText: z.string().describe('The full apply_patch text, including Begin Patch / End Patch markers'),
  }),
  execute: async ({ patchText }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'applyPatch',
      input: { patchTextLength: patchText.length },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      if (filesystem.readOnly) {
        throw new WorkspaceReadOnlyError('apply_patch');
      }

      let hunks: PatchHunk[];
      try {
        hunks = parseApplyPatch(patchText);
      } catch (error) {
        if (error instanceof ApplyPatchParseError) {
          span.end({ success: false });
          return error.message;
        }
        throw error;
      }

      const planned: PlannedChange[] = [];
      try {
        for (const hunk of hunks) {
          if (hunk.type === 'add') {
            if (await filesystem.exists(hunk.path)) {
              span.end({ success: false });
              return `File already exists: ${hunk.path}`;
            }
            planned.push({ action: 'add', path: hunk.path, content: hunk.contents });
            continue;
          }
          if (hunk.type === 'delete') {
            if (!(await filesystem.exists(hunk.path))) {
              span.end({ success: false });
              return `File not found: ${hunk.path}`;
            }
            planned.push({ action: 'delete', path: hunk.path });
            continue;
          }

          const raw = await filesystem.readFile(hunk.path, { encoding: 'utf-8' });
          if (typeof raw !== 'string') {
            span.end({ success: false });
            return `Cannot apply patch to binary file: ${hunk.path}`;
          }
          const content = applyChunks(raw, hunk.chunks);
          if (hunk.movePath) {
            planned.push({ action: 'move', from: hunk.path, to: hunk.movePath, content });
          } else {
            planned.push({ action: 'update', path: hunk.path, content });
          }
        }
      } catch (error) {
        if (error instanceof ApplyPatchHunkError || error instanceof FileNotFoundError) {
          span.end({ success: false });
          return error.message;
        }
        throw error;
      }

      let bytesTransferred = 0;
      const summary: string[] = [];
      for (const change of planned) {
        if (change.action === 'add') {
          await filesystem.writeFile(change.path, change.content, { overwrite: false });
          bytesTransferred += Buffer.byteLength(change.content, 'utf-8');
          summary.push(`A ${change.path}`);
        } else if (change.action === 'update') {
          await filesystem.writeFile(change.path, change.content, {
            overwrite: true,
            expectedMtime: expectedMtimeFor(context, change.path),
          });
          bytesTransferred += Buffer.byteLength(change.content, 'utf-8');
          summary.push(`M ${change.path}`);
        } else if (change.action === 'move') {
          await filesystem.writeFile(change.to, change.content, {
            overwrite: true,
            expectedMtime: expectedMtimeFor(context, change.to),
          });
          await filesystem.deleteFile(change.from);
          bytesTransferred += Buffer.byteLength(change.content, 'utf-8');
          summary.push(`M ${change.to}`);
        } else {
          await filesystem.deleteFile(change.path);
          summary.push(`D ${change.path}`);
        }
      }

      let output = `Success. Updated the following files:\n${summary.join('\n')}`;
      for (const change of planned) {
        if (change.action === 'delete') continue;
        const path = change.action === 'move' ? change.to : change.path;
        output += await getEditDiagnosticsText(workspace, path, change.content);
      }

      span.end({ success: true }, { bytesTransferred });
      return output;
    } catch (error) {
      if (
        error instanceof FileExistsError ||
        error instanceof FileNotFoundError ||
        error instanceof ApplyPatchHunkError
      ) {
        span.end({ success: false });
        return error.message;
      }
      span.error(error);
      throw error;
    }
  },
});
