import { Agent, type AgentConfig } from '../../agent';

import { WORKFLOW_BUILDER_AUTHORING_PLAYBOOK } from './authoring-playbook.js';

export interface WorkflowBuilderAgentOptions<TAgentId extends string> extends Omit<
  AgentConfig<TAgentId>,
  'instructions'
> {
  surfaceInstructions: string;
}

/**
 * Creates a Workflow Builder agent with the shared composition contract and a
 * concrete surface policy for resource discovery and mutation semantics.
 */
export function createWorkflowBuilderAgent<TAgentId extends string>({
  surfaceInstructions,
  ...config
}: WorkflowBuilderAgentOptions<TAgentId>): Agent<TAgentId> {
  return new Agent({
    ...config,
    instructions: `${WORKFLOW_BUILDER_AUTHORING_PLAYBOOK}\n\n${surfaceInstructions}`,
  });
}
