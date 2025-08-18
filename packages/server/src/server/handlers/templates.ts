import type { RuntimeContext } from '@mastra/core/runtime-context';
import { agentBuilderTemplateWorkflow } from '@mastra/agent-builder';
import type { Context } from '../types';
import { handleError } from './error';

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

export interface TemplateInstallationResult {
  /** Whether installation was successful */
  success: boolean;
  /** Whether any changes were applied */
  applied: boolean;
  /** Git branch name created for the installation */
  branchName?: string;
  /** Success/error message */
  message: string;
  /** Validation results if available */
  validationResults?: {
    valid: boolean;
    errorsFixed: number;
    remainingErrors: number;
  };
  /** Error details if installation failed */
  error?: string;
  /** Array of errors from different steps */
  errors?: string[];
  /** Detailed step results */
  stepResults?: {
    copySuccess: boolean;
    mergeSuccess: boolean;
    validationSuccess: boolean;
    filesCopied: number;
    conflictsSkipped: number;
    conflictsResolved: number;
  };
}

export async function installTemplateHandler({
  mastra,
  runtimeContext,
  repo,
  ref,
  slug,
  targetPath,
  variables,
}: Context & {
  runtimeContext: RuntimeContext;
  repo: string;
  ref?: string;
  slug?: string;
  targetPath?: string;
  variables?: Record<string, string>;
}): Promise<TemplateInstallationResult> {
  const logger = mastra.getLogger();

  try {
    logger.info('Starting template installation', { repo, ref, slug, targetPath, variables });

    // Create workflow run
    const run = await agentBuilderTemplateWorkflow.createRunAsync();

    // Set environment variables in runtime context if provided
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        runtimeContext.set(key, value);
      });
    }

    logger.info('Starting agent-builder template workflow', {
      runId: run.runId,
      repo,
      ref: ref || 'main',
    });

    // Start the workflow with template installation parameters
    const result = await run.start({
      inputData: {
        repo,
        ref: ref || 'main',
        slug,
        targetPath,
      },
      runtimeContext,
    });

    logger.info('Template workflow completed', {
      runId: run.runId,
      status: result.status,
    });

    // Transform workflow result to our expected format
    if (result.status === 'success') {
      return {
        success: result.result.success || false,
        applied: result.result.applied || false,
        branchName: result.result.branchName,
        message: result.result.message || 'Template installation completed',
        validationResults: result.result.validationResults,
        error: result.result.error,
        errors: result.result.errors,
        stepResults: result.result.stepResults,
      };
    } else if (result.status === 'failed') {
      return {
        success: false,
        applied: false,
        message: `Template installation failed: ${result.error.message}`,
        error: result.error.message,
      };
    } else {
      return {
        success: false,
        applied: false,
        message: 'Template installation was suspended',
        error: 'Workflow suspended - manual intervention required',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Template installation failed', {
      repo,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return handleError(error, 'Template installation failed');
  }
}
