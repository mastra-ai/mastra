import { GetAgentResponse } from '@mastra/client-js';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { ErrorState } from '@/ds/components/ErrorState';
import { is403ForbiddenError } from '@/lib/query-utils';
import { EntityList } from '@/ds/components/EntityList';

import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';

import { extractPrompt } from '../../utils/extractPrompt';
import { ProviderLogo } from '../agent-metadata/provider-logo';
import { NoAgentsInfo } from './no-agents-info';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { TextAndIcon } from '@/ds/components/Text';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { WorkflowIcon } from '@/ds/icons';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { truncateString } from '@/lib/truncate-string';

export interface AgentsListProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
  search?: string;
  onSearch?: (search: string) => void;
  hideToolbar?: boolean;
}

export function AgentsList({ agents, isLoading, error, onCreateClick, search: externalSearch }: AgentsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const agentData = useMemo(() => Object.values(agents ?? {}), [agents]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return agentData.filter(agent => {
      const instructions = extractPrompt(agent.instructions);
      return agent.name.toLowerCase().includes(term) || instructions.toLowerCase().includes(term);
    });
  }, [agentData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="agents" />;
  }

  if (error) {
    return <ErrorState title="Failed to load agents" message={error.message} />;
  }

  if (agentData.length === 0 && !isLoading) {
    return <NoAgentsInfo onCreateClick={onCreateClick} />;
  }

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

      {filteredData.map(agent => {
        const name = truncateString(agent.name, 50);
        const instructions = truncateString(extractPrompt(agent.instructions), 200);
        const agentsCount = Object.keys(agent.agents ?? {}).length;
        const toolsCount = Object.keys(agent.tools ?? {}).length;
        const workflowsCount = Object.keys(agent.workflows ?? {}).length;

        return (
          <EntityList.RowLink key={agent.id} to={paths.agentLink(agent.id)}>
            <EntityList.NameCell>{name || ''}</EntityList.NameCell>
            <EntityList.DescriptionCell>{instructions || ''}</EntityList.DescriptionCell>
            <EntityList.Cell>
              <TextAndIcon>
                {agent.provider && <ProviderLogo providerId={agent.provider} />}
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
