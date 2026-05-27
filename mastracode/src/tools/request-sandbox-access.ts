/**
 * request_access tool — requests permission to access a directory outside the project root.
 * The user can approve or deny the request via TUI dialog.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import type { HarnessQuestionAnswer, HarnessRequestContext } from '@mastra/core/harness';
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

type HarnessV1SuspensionContext = {
  registerQuestion: (params: {
    questionId: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
    selectionMode?: 'single_select' | 'multi_select';
    runId?: string;
    toolCallId?: string;
  }) => Promise<void>;
  registerSandboxAccess?: (params: {
    requestId: string;
    semanticType: 'file' | 'command' | 'network' | 'mcp' | 'custom';
    reason?: string;
    payload?: Record<string, unknown>;
    runId?: string;
    toolCallId?: string;
  }) => Promise<void>;
};
type ToolExecutionContext = {
  agent?: {
    runId?: string;
    toolCallId?: string;
    resumeData?: unknown;
    suspend?: (payload: unknown) => Promise<never>;
  };
  requestContext?: {
    get: (key: string) => unknown;
  };
  workspace?: {
    filesystem?: unknown;
  };
};

let requestCounter = 0;

type RequestSandboxAccessInput = {
  path: string;
  reason: string;
};

const requestSandboxAccessInputSchema = z.object({
  path: z.string().min(1).describe('The absolute path to the directory you need access to.'),
  reason: z.string().min(1).describe('Brief explanation of why you need access to this directory.'),
});

function answerApproved(answer: HarnessQuestionAnswer | unknown): boolean {
  if (typeof answer === 'object' && answer !== null && 'approved' in answer) {
    return (answer as { approved?: unknown }).approved === true;
  }
  const value =
    typeof answer === 'object' && answer !== null && 'answer' in answer
      ? (answer as { answer: HarnessQuestionAnswer }).answer
      : answer;
  const answerText = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  return answerText.toLowerCase().startsWith('y') || answerText.toLowerCase() === 'approve';
}

export const requestSandboxAccessTool = createTool({
  id: 'request_access',
  description: `Request permission to access a directory outside the current project. Use this when you need to read or write files in a directory that is not within the project root. The user will be prompted to approve or deny the request.`,
  inputSchema: requestSandboxAccessInputSchema,
  execute: async ({ path: requestedPath, reason }: RequestSandboxAccessInput, context: any) => {
    let propagatingHarnessV1Suspension = false;
    try {
      const toolContext = context as ToolExecutionContext | undefined;
      const harnessCtx = toolContext?.requestContext?.get('harness') as
        | HarnessRequestContext<MastraCodeState>
        | undefined;
      const harnessV1Ctx = harnessCtx as unknown as HarnessV1SuspensionContext | undefined;
      const resumeData = toolContext?.agent?.resumeData;

      // Resolve to absolute path (expand ~ first since Node path APIs don't handle it)
      const expanded = expandTilde(requestedPath);
      const absolutePath = path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded);

      // Check if already allowed
      const harnessState =
        harnessCtx?.getState?.() ?? (harnessCtx as unknown as { state?: { projectPath?: string } } | undefined)?.state;
      const projectRoot = harnessState?.projectPath ? path.resolve(harnessState.projectPath) : process.cwd();
      const allowedPaths = getAllowedPathsFromContext(toolContext);
      if (isPathAllowed(absolutePath, projectRoot, allowedPaths)) {
        return {
          content: `Access already granted: "${absolutePath}" is within the project root or allowed paths.`,
          isError: false,
        };
      }

      if (!harnessCtx || (!harnessCtx.registerQuestion && !harnessV1Ctx?.registerSandboxAccess)) {
        return {
          content: `Cannot request sandbox access: TUI context not available. The user should manually run /sandbox add ${absolutePath}`,
          isError: true,
        };
      }

      const fallbackQuestionId = `sandbox_${++requestCounter}_${Date.now()}`;
      const questionId = toolContext?.agent?.toolCallId ?? fallbackQuestionId;
      let answer: HarnessQuestionAnswer | unknown = resumeData;

      if (answer === undefined && toolContext?.agent?.suspend) {
        if (!toolContext.agent.runId || !toolContext.agent.toolCallId) {
          throw new Error('request_access requires agent runId and toolCallId for Harness v1 suspension.');
        }
        // Harness v1 path: park the tool through the native sandbox-access surface when available.
        if (harnessV1Ctx?.registerSandboxAccess) {
          await harnessV1Ctx.registerSandboxAccess({
            requestId: toolContext.agent.toolCallId,
            semanticType: 'file',
            reason,
            payload: { path: absolutePath },
            runId: toolContext.agent.runId,
            toolCallId: toolContext.agent.toolCallId,
          });
        } else if (harnessV1Ctx?.registerQuestion) {
          await harnessV1Ctx.registerQuestion({
            questionId: toolContext.agent.toolCallId,
            question: `Allow Mastra Code to access ${absolutePath}?\n\n${reason}`,
            options: [
              { label: 'Yes', description: 'Grant access for this session.' },
              { label: 'No', description: 'Deny this access request.' },
            ],
            selectionMode: 'single_select',
            runId: toolContext.agent.runId,
            toolCallId: toolContext.agent.toolCallId,
          });
        }
        propagatingHarnessV1Suspension = true;
        await toolContext.agent.suspend({});
        propagatingHarnessV1Suspension = false;
        // Defensive fallback for non-conforming runtimes; Harness v1 suspend() throws.
        return {
          content: 'Access request could not be processed: suspension did not complete.',
          isError: true,
        };
      } else if (answer === undefined && harnessCtx.emitEvent && harnessCtx.registerQuestion) {
        // Legacy Harness path: emit directly and resolve through the in-memory callback registry.
        answer = await new Promise<HarnessQuestionAnswer>(resolve => {
          harnessCtx.registerQuestion!({
            questionId,
            resolve: value => {
              resolve(Array.isArray(value) ? value.join(',') : value);
            },
          });

          harnessCtx.emitEvent!({
            type: 'sandbox_access_request',
            questionId,
            path: absolutePath,
            reason,
          });
        });
      }

      const approved = answerApproved(answer);
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
        const fs = toolContext?.workspace?.filesystem;
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
      if (propagatingHarnessV1Suspension) throw error;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: `Failed to request sandbox access: ${msg}`,
        isError: true,
      };
    }
  },
});
