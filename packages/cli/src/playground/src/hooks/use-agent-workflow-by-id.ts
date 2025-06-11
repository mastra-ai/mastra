import { useAgent } from './use-agents';
import { useWorkflow } from './use-workflows';

export interface AgentWorkflowById {
  workflowId: string;
  agentId?: string;
  enabled?: boolean;
}

export const useAgentWorkflowById = ({ agentId, workflowId, enabled = true }: AgentWorkflowById) => {
  const { data: workflowOnly, isLoading: isWorkflowLoading } = useWorkflow(workflowId, !agentId && enabled);
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!, Boolean(agentId) && enabled);

  const workflowFromAgent = agent?.workflows[workflowId];
  const isLoading = isWorkflowLoading || isAgentLoading;

  const workflow = workflowFromAgent ?? workflowOnly;

  return { workflow, isLoading, agent };
};
