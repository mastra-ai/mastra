import type { GetAgentResponse } from '@mastra/client-js';
import {
  EntityList,
  EntityListSkeleton,
  TextAndIcon,
  WorkflowIcon,
  AgentIcon,
  ToolsIcon,
  truncateString,
} from '@mastra/playground-ui';
import { useMemo } from 'react';
import { extractPrompt } from '../../utils/extractPrompt';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { useLinkComponent } from '@/lib/framework';

export interface AgentsListProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  search?: string;
}

export function AgentsList({ agents, isLoading, search = '' }: AgentsListProps) {
  const { paths, Link } = useLinkComponent();

  const agentData = useMemo(() => Object.values(agents ?? {}), [agents]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return agentData.filter(agent => {
      const instructions = extractPrompt(agent.instructions);
      return agent.name.toLowerCase().includes(term) || instructions.toLowerCase().includes(term);
    });
  }, [agentData, search]);

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto auto auto" />;
  }

  return (
    <EntityList columns={'auto 1fr auto auto auto auto'}>
      <EntityList.Top>
        <EntityList.TopCell className="">Name</EntityList.TopCell>
        <EntityList.TopCell className="">Instructions</EntityList.TopCell>
        <EntityList.TopCell className="">Model</EntityList.TopCell>
        <EntityList.TopCellSmart
          long="Workflows"
          short={<WorkflowIcon />}
          tooltip="Number of attached Workflows"
          className="text-center"
        />
        <EntityList.TopCellSmart
          long="Agents"
          short={<AgentIcon />}
          tooltip="Number of attached Agents"
          className="text-center"
        />
        <EntityList.TopCellSmart
          long="Tools"
          short={<ToolsIcon />}
          tooltip="Number of attached Tools"
          className="text-center"
        />
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Agents match your search" /> : null}

      {filteredData.map(agent => {
        const name = truncateString(agent.name, 50);
        const instructions = truncateString(extractPrompt(agent.instructions), 200);
        const agentsCount = Object.keys(agent.agents ?? {}).length;
        const toolsCount = Object.keys(agent.tools ?? {}).length;
        const workflowsCount = Object.keys(agent.workflows ?? {}).length;

        return (
          <EntityList.RowLink key={agent.id} to={paths.agentLink(agent.id)} LinkComponent={Link}>
            <EntityList.NameCell>{name || ''}</EntityList.NameCell>
            <EntityList.DescriptionCell>{instructions || ''}</EntityList.DescriptionCell>
            <EntityList.Cell>
              <TextAndIcon>
                {agent.provider && <ProviderLogo providerId={agent.provider} className="dark:invert" />}
                <span className="truncate">{agent.modelId || 'N/A'}</span>
              </TextAndIcon>
            </EntityList.Cell>
            <EntityList.TextCell className="text-center">{workflowsCount || ''}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">{toolsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
