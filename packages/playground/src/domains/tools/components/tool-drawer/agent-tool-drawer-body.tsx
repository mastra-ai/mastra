import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useAgent, useExecuteAgentTool } from '@mastra/react/hooks/agents';
import type { ToolExecution } from '../../utils/tool-run';
import { useOpenToolId } from './open-tool-context';
import { ToolDrawerBody } from './tool-drawer-body';

export interface AgentToolDrawerBodyProps {
  agentId: string;
}

export function AgentToolDrawerBody({ agentId }: AgentToolDrawerBodyProps) {
  const toolId = useOpenToolId();
  const [agentRequestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent, isLoading } = useAgent({ agentId, requestContext: agentRequestContext });
  const { mutateAsync, status, data, error } = useExecuteAgentTool();
  const tool = Object.values(agent?.tools ?? {}).find(candidate => candidate.id === toolId);
  // Run through the agent: agent-only tools aren't registered in the global tools API.
  const execution: ToolExecution = {
    execute: (input, requestContext) =>
      mutateAsync({ agentId, toolId, input, playgroundRequestContext: requestContext }),
    status,
    output: data,
    error,
  };

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>This agent has no tool "{toolId}".</DataPanel.NoData>;

  return (
    <ToolDrawerBody
      tool={tool}
      execution={execution}
      currentAgentId={agentId}
      requestContextEntityType="agent-tool"
      requestContextEntityId={`${agentId}:${tool.id}`}
    />
  );
}
