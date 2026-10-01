import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { ToolDrawerBody } from './tool-drawer-body';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useExecuteAgentTool } from '@/domains/agents/hooks/use-execute-agent-tool';

export interface AgentToolDrawerBodyProps {
  agentId: string;
  toolId: string;
}

export function AgentToolDrawerBody({ agentId, toolId }: AgentToolDrawerBodyProps) {
  const { data: agent, isLoading } = useAgent(agentId, useEntityRequestContext('agent', agentId)[0]);
  const { mutateAsync } = useExecuteAgentTool();
  const tool = Object.values(agent?.tools ?? {}).find(candidate => candidate.id === toolId);

  if (isLoading) return <DataPanel.LoadingData />;
  if (!tool) return <DataPanel.NoData>This agent has no tool "{toolId}".</DataPanel.NoData>;

  return (
    <ToolDrawerBody
      tool={tool}
      // Run through the agent: agent-only tools aren't registered in the global tools API.
      execute={(data, requestContext) =>
        mutateAsync({ agentId, toolId, input: data, playgroundRequestContext: requestContext })
      }
      requestContextEntityType="agent-tool"
      requestContextEntityId={`${agentId}:${toolId}`}
      currentAgentId={agentId}
    />
  );
}
