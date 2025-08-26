import { ReadableStream } from 'node:stream/web';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { agentBuilderTemplateWorkflow } from '@mastra/agent-builder';
import type { Context } from '../types';
import { handleError } from './error';
import { basename, dirname } from 'path';
import { getWorkflowInfo, WorkflowRegistry } from '../utils';
import type { WorkflowInfo } from '@mastra/core/workflows';
import * as workflows from './workflows';

interface TemplateContext extends Context {
  runtimeContext?: RuntimeContext;
  runId?: string;
  repo: string;
  ref?: string;
  slug?: string;
  targetPath?: string;
  variables?: Record<string, string>;
  body?: { step: string | string[]; resumeData?: unknown };
  event?: string;
  data?: unknown;
}

export interface TemplateInstallationRequest {
  /** Template repository URL or slug */
  repo: string;
  /** Git ref (branch/tag/commit) to install from */
  ref?: string;
  /** Template slug for identification */
  slug?: string;
  /** Target project path */
  targetPath?: string;
  /** Environment variables for template */
  variables?: Record<string, string>;
}

// Helper function to resolve target path and set runtime context variables
function prepareTemplateInstallation({
  targetPath,
  variables,
  runtimeContext,
}: {
  targetPath?: string;
  variables?: Record<string, string>;
  runtimeContext?: RuntimeContext;
}) {
  // Resolve default targetPath when not explicitly provided
  let effectiveTargetPath = targetPath;
  if (!effectiveTargetPath) {
    const envRoot = process.env.MASTRA_PROJECT_ROOT?.trim();
    if (envRoot) {
      effectiveTargetPath = envRoot;
    } else {
      const cwd = process.cwd();
      const parent = dirname(cwd);
      const grand = dirname(parent);
      // Detect when running under `<project>/.mastra/output` and resolve back to project root
      if (basename(cwd) === 'output' && basename(parent) === '.mastra') {
        effectiveTargetPath = grand;
      } else {
        effectiveTargetPath = cwd;
      }
    }
  }

  // Set environment variables in runtime context if provided
  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      runtimeContext?.set(key, value);
    });
  }

  return effectiveTargetPath;
}

/**
 * Creates a modified Mastra instance that includes the agent-builder-template workflow
 * and prepares template installation parameters
 */
function createTemplateWorkflowContext({
  targetPath,
  variables,
  runtimeContext,
  repo,
  ref,
  slug,
}: {
  targetPath?: string;
  variables?: Record<string, string>;
  runtimeContext?: RuntimeContext;
  repo: string;
  ref?: string;
  slug?: string;
}) {
  const effectiveTargetPath = prepareTemplateInstallation({ targetPath, variables, runtimeContext });

  WorkflowRegistry.registerTemporaryWorkflow('agent-builder-template', agentBuilderTemplateWorkflow);

  const inputData = {
    repo,
    ref: ref || 'main',
    slug: slug || basename(repo).replace(/\.git$/, '') || 'template',
    targetPath: effectiveTargetPath,
  };

  return {
    inputData,
    effectiveTargetPath,
  };
}

/**
 * Generic wrapper that converts template handlers to use workflow handlers
 * TWorkflowArgs - The argument type expected by the workflow handler
 * TResult - The return type of the workflow handler
 */
function createTemplateHandler<TWorkflowArgs, TResult>(
  workflowHandlerFn: (args: TWorkflowArgs) => Promise<TResult>,
  logMessage: string,
) {
  return async (templateArgs: TemplateContext): Promise<TResult> => {
    const { mastra, runtimeContext, repo, ref, slug, targetPath, variables, runId, body, event, data } = templateArgs;
    const logger = mastra.getLogger();

    try {
      const { inputData, effectiveTargetPath } = createTemplateWorkflowContext({
        targetPath,
        variables,
        runtimeContext,
        repo,
        ref,
        slug,
      });

      logger.info(logMessage, {
        runId,
        repo,
        ref: ref || 'main',
        slug,
        targetPath: effectiveTargetPath,
        variables,
        ...(body && { step: body.step }),
        ...(event && { event }),
      });

      try {
        // Build the handler args based on what the workflow handler expects
        // TypeScript will ensure we match the TWorkflowArgs type
        const baseArgs = {
          mastra,
          workflowId: 'agent-builder-template' as const,
          runId,
          runtimeContext,
        };

        const handlerArgs = {
          ...baseArgs,
          // Add body for resume handlers
          ...(body && { body }),
          // Add event and data for event handlers
          ...(event !== undefined && data !== undefined && { event, data }),
          // Add inputData for regular handlers (when no body or event)
          ...(!body && event === undefined && { inputData }),
        } as TWorkflowArgs;

        const result = await workflowHandlerFn(handlerArgs);
        return result;
      } finally {
        // Clean up the temporary workflow registration
        WorkflowRegistry.cleanup('agent-builder-template');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`${logMessage} failed`, {
        runId,
        repo,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  };
}

// Now create all template handlers using the utility
export const createTemplateInstallRunHandler = createTemplateHandler(
  workflows.createWorkflowRunHandler,
  'Creating template installation run',
);

export const startAsyncTemplateInstallHandler = createTemplateHandler(
  workflows.startAsyncWorkflowHandler,
  'Starting async template installation',
);

export const streamTemplateInstallHandler = createTemplateHandler(
  workflows.streamWorkflowHandler,
  'Starting template installation stream',
);

export const streamVNextTemplateInstallHandler = createTemplateHandler(
  workflows.streamVNextWorkflowHandler,
  'Starting VNext template installation stream',
);

export const startTemplateInstallRunHandler = createTemplateHandler(
  workflows.startWorkflowRunHandler,
  'Starting template installation run',
);

export const watchTemplateInstallHandler = createTemplateHandler(
  workflows.watchWorkflowHandler,
  'Watching template installation',
);

export const getTemplateInstallRunByIdHandler = createTemplateHandler(
  workflows.getWorkflowRunByIdHandler,
  'Getting template installation run by ID',
);

export const getTemplateInstallRunExecutionResultHandler = createTemplateHandler(
  workflows.getWorkflowRunExecutionResultHandler,
  'Getting template installation run execution result',
);

export const getTemplateInstallRunsHandler = createTemplateHandler(
  workflows.getWorkflowRunsHandler,
  'Getting template installation runs',
);

export const cancelTemplateInstallRunHandler = createTemplateHandler(
  workflows.cancelWorkflowRunHandler,
  'Cancelling template installation run',
);

export const sendTemplateInstallRunEventHandler = createTemplateHandler(
  workflows.sendWorkflowRunEventHandler,
  'Sending template installation run event',
);

// Resume handlers now use the unified createTemplateHandler pattern
export const resumeAsyncTemplateInstallHandler = createTemplateHandler(
  workflows.resumeAsyncWorkflowHandler,
  'Resuming async template installation',
);

export const resumeTemplateInstallHandler = createTemplateHandler(
  workflows.resumeWorkflowHandler,
  'Resuming template installation',
);

export async function getAgentBuilderWorkflow(): Promise<WorkflowInfo> {
  try {
    return getWorkflowInfo(agentBuilderTemplateWorkflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}
