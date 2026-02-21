/**
 * Workflow executors for durable agents.
 *
 * This module provides different execution strategies for durable workflows:
 * - LocalWorkflowExecutor: Direct execution in current process
 */

export type { WorkflowExecutor, WorkflowExecutionResult } from './types';
export { LocalWorkflowExecutor, localExecutor } from './local-executor';
