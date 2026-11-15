import type { Workflow } from '@mastra/core/workflows';
import { agentBuilderTemplateWorkflow, createAgentBuilderTemplateWorkflow } from './template-builder/template-builder';
import { createWorkflowBuilderWorkflow, workflowBuilderWorkflow } from './workflow-builder/workflow-builder';

/**
 * Agent-builder workflows shared by everything that imports this module. Fine for a process with one Mastra
 * instance; use `createAgentBuilderWorkflows` when a process runs several.
 */
export const agentBuilderWorkflows: Record<string, Workflow<any, any, any, any, any, any>> = {
  'merge-template': agentBuilderTemplateWorkflow,
  'workflow-builder': workflowBuilderWorkflow,
};

/**
 * Builds a new set of agent-builder workflows on every call, with the same keys as `agentBuilderWorkflows`.
 *
 * Registering a workflow with a Mastra instance binds it to that instance's storage, logger and agents, and the
 * workflow keeps every run it has not finished. A workflow object registered with a second instance moves to it,
 * including runs that are still executing for the first one. Use this factory when one process runs several Mastra
 * instances, such as one per tenant or one per test, so each instance gets its own workflows and can be garbage
 * collected after `mastra.shutdown()`.
 *
 * @example
 * ```ts
 * const mastra = new Mastra({ workflows: createAgentBuilderWorkflows() });
 * ```
 */
export function createAgentBuilderWorkflows(): Record<string, Workflow<any, any, any, any, any, any>> {
  return {
    'merge-template': createAgentBuilderTemplateWorkflow(),
    'workflow-builder': createWorkflowBuilderWorkflow(),
  };
}
