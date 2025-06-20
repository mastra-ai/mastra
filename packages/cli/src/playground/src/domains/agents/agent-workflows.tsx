import { GetAgentResponse } from '@mastra/client-js';

import { Txt } from '@mastra/playground-ui';
import { WorkflowList } from './workflow-list';

export interface AgentWorkflowsProps {
  agent: GetAgentResponse;
  agentId: string;
}

export const AgentWorkflows = ({ agent, agentId }: AgentWorkflowsProps) => {
  const workflows = Object.entries(agent?.workflows ?? {}).map(([workflowKey, workflow]) => ({
    id: workflowKey,
    description: `Contains ${Object.keys(workflow.steps || {}).length} steps`,
  }));

  return (
    <>
      {workflows.length > 0 ? (
        <WorkflowList workflows={workflows} agentId={agentId} />
      ) : (
        <Txt as="p" variant="ui-lg" className="text-icon6">
          No workflows were attached to this agent.
        </Txt>
      )}
    </>
  );
};
