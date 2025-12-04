/**
 * Vercel Workflow Runtime Wrappers
 *
 * This file contains the wrapper functions WITH Vercel's directives.
 *
 * CRITICAL: This file uses dynamic imports to avoid Vercel's static analysis
 * following the import chain to Node.js modules.
 */

/**
 * Step execution with Vercel durability.
 */
export async function runStep(operationId: string, runId: string, workflowId: string): Promise<unknown> {
  'use step';
  const { runStepImpl } = await import('@mastra/vercel');
  return runStepImpl(operationId, runId, workflowId);
}

/**
 * Main workflow execution with Vercel durability.
 */
export async function mainWorkflow(
  params: Parameters<typeof import('@mastra/vercel').mainWorkflowImpl>[0],
): Promise<Awaited<ReturnType<typeof import('@mastra/vercel').mainWorkflowImpl>>> {
  'use workflow';
  const { mainWorkflowImpl } = await import('@mastra/vercel');
  return mainWorkflowImpl(params);
}
