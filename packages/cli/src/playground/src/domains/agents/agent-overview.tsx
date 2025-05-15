import { GetAgentResponse } from '@mastra/client-js';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';
import { ToolList } from './tool-list';
import { Txt } from '@mastra/playground-ui';
import { WorkflowList } from './workflow-list';
import { Link } from 'react-router';

export interface AgentOverviewProps {
  agent: GetAgentResponse;
  agentId: string;
}

export const AgentOverview = ({ agent, agentId }: AgentOverviewProps) => {
  const toolsArray = Object.entries(agent?.tools ?? {}).map(([toolKey, tool]) => ({
    name: toolKey,
    id: tool.id,
    description: tool.description,
  }));

  const workflows = Object.entries(agent?.workflows ?? {}).map(([workflowKey, workflow]) => ({
    id: workflowKey,
    description: `Contains ${Object.keys(workflow.steps || {}).length} steps`,
  }));

  return (
    <div className="py-2 overflow-y-auto h-full">
      <div className="px-5">
        <AgentPromptEnhancer agentId={agentId} />
      </div>

      <hr className="border-border1 border-sm my-5" />

      <div className="px-5">
        <Txt as="h3" variant="ui-md" className="text-icon3 pb-1">
          Agent Tools
        </Txt>

        {toolsArray.length > 0 ? (
          <ToolList tools={toolsArray} agentId={agentId} />
        ) : (
          <Txt as="p" variant="ui-lg" className="text-icon6">
            No tools found. You can add tools by following the{' '}
            <Link to="https://mastra.ai/en/docs/agents/using-tools-and-mcp" className="underline" target="_blank">
              Agents and Tools
            </Link>{' '}
            documentation.
          </Txt>
        )}
      </div>

      <hr className="border-border1 border-sm my-5" />

      <div className="px-5">
        <Txt as="h3" variant="ui-md" className="text-icon3 pb-1">
          Agent Workflows
        </Txt>

        {workflows.length > 0 ? (
          <WorkflowList workflows={workflows} agentId={agentId} />
        ) : (
          <Txt as="p" variant="ui-lg" className="text-icon6">
            No workflows were attached to this agent.
          </Txt>
        )}
      </div>
    </div>
  );
};
