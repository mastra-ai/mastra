/**
 * request_access tool — requests permission to access a directory outside the project root.
 * The user can approve or deny the request via TUI dialog.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { createTool } from '@mastra/core/tools';
import { LocalFilesystem } from '@mastra/core/workspace';
import { z } from 'zod';
import type { MastraCodeState } from '../schema.js';
import { isPathAllowed, getAllowedPathsFromContext } from './utils.js';

function expandTilde(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

type RequestSandboxAccessInput = {
  path: string;
  reason: string;
};

const requestSandboxAccessInputSchema = z.object({
  path: z.string().min(1).describe('The absolute path to the directory you need access to.'),
  reason: z.string().min(1).describe('Brief explanation of why you need access to this directory.'),
});

export const requestSandboxAccessTool = createTool({
  id: 'request_access',
  description: `Request permission to access a directory outside the current project. Use this when you need to read or write files in a directory that is not within the project root. The user will be prompted to approve or deny the request.`,
  inputSchema: requestSandboxAccessInputSchema,
  suspendSchema: z.object({
    kind: z.literal('sandbox_access_request'),
    path: z.string(),
    reason: z.string(),
  }),
  resumeSchema: z.union([z.string(), z.array(z.string())]),
  execute: async ({ path: requestedPath, reason }: RequestSandboxAccessInput, context: any) => {
    try {
      const agentControllerCtx = context?.requestContext?.get('controller') as
        | AgentControllerRequestContext<MastraCodeState>
        | undefined;

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

      const suspend = context?.agent?.suspend ?? context?.suspend;
      const resumeData = context?.agent?.resumeData ?? context?.resumeData;

      // First pass: pause via the native tool-suspension primitive so the host can
      // prompt the user. The suspend payload carries the request details; the host
      // resumes with the user's answer as resume data.
      if (resumeData === undefined) {
        if (!suspend) {
          return {
            content: `Cannot request sandbox access: interactive context not available. The user should manually run /sandbox add ${absolutePath}`,
            isError: true,
          };
        }
        await suspend({ kind: 'sandbox_access_request', path: absolutePath, reason });
        return;
      }

      const answerText = Array.isArray(resumeData) ? resumeData.join(', ') : String(resumeData);
      const approved = answerText.toLowerCase().startsWith('y') || answerText.toLowerCase() === 'approve';
      if (approved) {
        // Persist to controller state first (and await it) so the value is
        // committed before the next tool call re-derives the workspace's
        // allowed paths from state. The workspace factory rebuilds the
        // filesystem allowlist from `sandboxAllowedPaths` on every call
        // (getDynamicWorkspace), so an unawaited setState would let that
        // rebuild clobber the in-turn widen below before the grant lands.
        const controllerState = agentControllerCtx?.getState();
        const currentAllowed = (controllerState?.sandboxAllowedPaths as string[] | undefined) ?? [];
        const nextAllowed = currentAllowed.includes(absolutePath) ? currentAllowed : [...currentAllowed, absolutePath];
        if (!currentAllowed.includes(absolutePath)) {
          await agentControllerCtx?.setState({
            sandboxAllowedPaths: nextAllowed,
          });
        }

        // Also update the live workspace filesystem immediately so tools in
        // the same turn (e.g. `view`) can access the path without waiting for
        // a fresh workspace build. The resolved workspace is carried on the
        // controller request context — the tool-execution context does not expose
        // it — so read the filesystem from there.
        const fs = agentControllerCtx?.workspace?.filesystem ?? context?.workspace?.filesystem;
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
} as any);
