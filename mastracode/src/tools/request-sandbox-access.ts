/**
 * request_access tool — requests permission to access a directory outside the project root.
 * The user can approve or deny the request via TUI dialog.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import type { HarnessRequestContext } from '@mastra/core/harness';
import { createTool } from '@mastra/core/tools';
import { LocalFilesystem } from '@mastra/core/workspace';
import { z } from 'zod';
import type { stateSchema } from '../schema.js';
import { isPathAllowed, getAllowedPathsFromContext } from './utils.js';

function expandTilde(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

type MastraCodeState = z.infer<typeof stateSchema>;

let requestCounter = 0;

export const requestSandboxAccessTool = createTool({
  id: 'request_access',
  description: `Request permission to access a directory outside the current project. Use this when you need to read or write files in a directory that is not within the project root. The user will be prompted to approve or deny the request.`,
  inputSchema: z.object({
    path: z.string().min(1).describe('The absolute path to the directory you need access to.'),
    reason: z.string().min(1).describe('Brief explanation of why you need access to this directory.'),
  }),
  execute: async ({ path: requestedPath, reason }, context) => {
    try {
      const harnessCtx = context?.requestContext?.get('harness') as HarnessRequestContext<MastraCodeState> | undefined;

      // Resolve to absolute path (expand ~ first since Node path APIs don't handle it)
      const expanded = expandTilde(requestedPath);
      const absolutePath = path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded);

      // Check if already allowed
      const projectRoot = process.cwd();
      const allowedPaths = getAllowedPathsFromContext(context);
      if (isPathAllowed(absolutePath, projectRoot, allowedPaths)) {
        return {
          content: `Access already granted: "${absolutePath}" is within the project root or allowed paths.`,
          isError: false,
        };
      }

      if (!harnessCtx?.emitEvent || !harnessCtx?.registerQuestion) {
        return {
          content: `Cannot request sandbox access: TUI context not available. The user should manually run /sandbox add ${absolutePath}`,
          isError: true,
        };
      }

      const questionId = `sandbox_${++requestCounter}_${Date.now()}`;

      // Create a promise that resolves when the user answers in the TUI
      const answer = await new Promise<string>(resolve => {
        // Register the resolver so respondToQuestion() can resolve it
        harnessCtx.registerQuestion!({ questionId, resolve });

        // Emit event — TUI will show the dialog
        harnessCtx.emitEvent!({
          type: 'sandbox_access_request',
          questionId,
          path: absolutePath,
          reason,
        });
      });

      const approved = answer.toLowerCase().startsWith('y') || answer.toLowerCase() === 'approve';
      if (approved) {
        // Add to allowed paths in harness state (persists across turns)
        const currentAllowed = (harnessCtx.getState?.()?.sandboxAllowedPaths as string[] | undefined) ?? [];
        if (!currentAllowed.includes(absolutePath)) {
          harnessCtx.setState?.({
            sandboxAllowedPaths: [...currentAllowed, absolutePath],
          });
        }

        // Also update the workspace filesystem immediately so tools in the
        // same turn can access the path without waiting for the next turn.
        const fs = context?.workspace?.filesystem;
        if (fs instanceof LocalFilesystem) {
          fs.setAllowedPaths((prev: readonly string[]) => [...prev, absolutePath]);
        }

        return {
          content: `Access granted: "${absolutePath}" has been added to allowed paths. You can now access files in this directory.`,
          isError: false,
        };
      } else {
        return {
          content: `Access denied: The user declined access to "${absolutePath}".`,
          isError: false,
        };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to request sandbox access: ${msg}`,
        isError: true,
      };
    }
  },
});
