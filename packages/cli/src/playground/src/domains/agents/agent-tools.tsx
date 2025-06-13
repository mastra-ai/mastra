import { GetAgentResponse } from '@mastra/client-js';
import { ToolList } from './tool-list';
import { Txt } from '@mastra/playground-ui';
import { Link } from 'react-router';

export interface AgentToolsProps {
  agent: GetAgentResponse;
  agentId: string;
}

export const AgentTools = ({ agent, agentId }: AgentToolsProps) => {
  const toolsArray = Object.entries(agent?.tools ?? {}).map(([toolKey, tool]) => ({
    name: toolKey,
    id: tool.id,
    description: tool.description,
  }));

  return (
    <>
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
    </>
  );
};
