import { ReadableStream } from 'node:stream/web';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { agentBuilderTemplateWorkflow } from '@mastra/agent-builder';
import type { Context } from '../types';
import { handleError } from './error';
import { basename, dirname } from 'path';
import { getWorkflowInfo } from '../utils';
import type { WorkflowInfo } from '@mastra/core/workflows';

interface TemplateContext extends Context {
  runtimeContext?: RuntimeContext;
  runId?: string;
  repo: string;
  ref?: string;
  slug?: string;
  targetPath?: string;
  variables?: Record<string, string>;
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

export async function createTemplateInstallRunHandler({
  mastra,
  runtimeContext,
  runId: prevRunId,
  repo,
  ref,
  slug,
  targetPath,
  variables,
}: TemplateContext): Promise<{ runId: string }> {
  const logger = mastra.getLogger();

  try {
    const effectiveTargetPath = prepareTemplateInstallation({ targetPath, variables, runtimeContext });

    logger.info('Creating template installation run', {
      repo,
      ref,
      slug,
      targetPath: effectiveTargetPath,
      variables,
    });

    // Create workflow run
    const run = await agentBuilderTemplateWorkflow.createRunAsync({ runId: prevRunId });

    logger.info('Created template installation run', {
      runId: run.runId,
      repo,
      ref: ref || 'main',
    });

    return { runId: run.runId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Failed to create template installation run', {
      repo,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
}

export async function startAsyncTemplateInstallHandler({
  mastra,
  runtimeContext,
  runId,
  repo,
  ref,
  slug,
  targetPath,
  variables,
}: TemplateContext) {
  const logger = mastra.getLogger();

  try {
    const effectiveTargetPath = prepareTemplateInstallation({ targetPath, variables, runtimeContext });

    logger.info('Starting async template installation', {
      runId,
      repo,
      ref,
      slug,
      targetPath: effectiveTargetPath,
      variables,
    });

    // Get the workflow run and start it
    const run = await agentBuilderTemplateWorkflow.createRunAsync({ runId });
    const result = await run.start({
      inputData: {
        repo,
        ref: ref || 'main',
        slug,
        targetPath: effectiveTargetPath,
      },
      runtimeContext,
    });

    logger.info('Template workflow completed', {
      runId,
      status: result.status,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Async template installation failed', {
      runId,
      repo,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return handleError(error, 'Async template installation failed');
  }
}

export async function streamTemplateInstallHandler({
  mastra,
  runtimeContext,
  runId,
  repo,
  ref,
  slug,
  targetPath,
  variables,
}: TemplateContext) {
  const logger = mastra.getLogger();

  try {
    const effectiveTargetPath = prepareTemplateInstallation({ targetPath, variables, runtimeContext });

    logger.info('Starting template installation stream', {
      runId,
      repo,
      ref,
      slug,
      targetPath: effectiveTargetPath,
      variables,
    });

    // Get the workflow run and stream it
    const run = await agentBuilderTemplateWorkflow.createRunAsync({ runId });
    const result = run.stream({
      inputData: {
        repo,
        ref: ref || 'main',
        slug,
        targetPath: effectiveTargetPath,
      },
      runtimeContext,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Template installation stream failed', {
      runId,
      repo,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return handleError(error, 'Template installation stream failed');
  }
}

export async function getAgentBuilderWorkflow(): Promise<WorkflowInfo> {
  try {
    return getWorkflowInfo(agentBuilderTemplateWorkflow);
  } catch (error) {
    return handleError(error, 'Error getting workflow');
  }
}
