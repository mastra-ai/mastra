import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useAgent, useExecuteAgentTool } from '@mastra/react/hooks/agents';
import type { ExecuteTool } from '../../hooks/use-tool-run';
import { ToolDrawerBody } from './tool-drawer-body';

export interface AgentToolDrawerBodyProps {
  agentId: string;
  toolId: string;
}

export function AgentToolDrawerBody({ agentId, toolId }: AgentToolDrawerBodyProps) {
  const { data: agent, isLoading } = useAgent({
    agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
  });
  const { mutateAsync } = useExecuteAgentTool();
  const tool = Object.values(agent?.tools ?? {}).find(candidate => candidate.id === toolId);
  // Run through the agent: agent-only tools aren't registered in the global tools API.
  const execute: ExecuteTool = (data, requestContext) =>
    mutateAsync({ agentId, toolId, input: data, playgroundRequestContext: requestContext });

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>This agent has no tool "{toolId}".</DataPanel.NoData>;

  return (
    <ToolDrawerBody
      tool={tool}
      execute={execute}
      currentAgentId={agentId}
      requestContextEntityType="agent-tool"
      requestContextEntityId={`${agentId}:${tool.id}`}
    />
  );
}
