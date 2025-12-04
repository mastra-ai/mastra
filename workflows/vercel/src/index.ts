/**
 * @mastra/vercel
 *
 * Mastra integration with Vercel's Workflow SDK for durable execution.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
 * import { registerMastra, VercelWorkflow } from '@mastra/vercel';
 * import { z } from 'zod';
 *
 * // Define your workflow
 * const myWorkflow = new VercelWorkflow({
 *   id: 'my-workflow',
 *   inputSchema: z.object({ value: z.number() }),
 *   outputSchema: z.object({ result: z.number() }),
 * });
 *
 * // Build the workflow
 * myWorkflow
 *   .then(stepA)
 *   .then(stepB)
 *   .commit();
 *
 * // Create Mastra instance
 * export const mastra = new Mastra({
 *   workflows: { myWorkflow },
 * });
 *
 * // IMPORTANT: Register at module load time
 * registerMastra(mastra);
 * ```
 */

// Singleton registration
export { registerMastra, getMastra, hasMastra, clearMastra } from './singleton';

// Core classes
export { VercelExecutionEngine } from './execution-engine';
export { VercelWorkflow } from './workflow';
export { VercelRun } from './run';

// Runtime registration and implementation functions
// Users must create wrappers WITH directives in their project
export { registerRuntime, runStepImpl, mainWorkflowImpl } from './runtime.workflow';

// Types
export type { VercelEngineType, VercelWorkflowConfig, MainWorkflowParams } from './types';
