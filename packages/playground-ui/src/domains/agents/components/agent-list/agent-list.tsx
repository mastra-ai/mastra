import { GetAgentResponse } from '@mastra/client-js';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { ErrorState } from '@/ds/components/ErrorState';
import { is403ForbiddenError } from '@/lib/query-utils';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';

import { useMemo, useState } from 'react';

import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { Chip, ChipsGroup } from '@/index';
import { extractPrompt } from '../../utils/extractPrompt';
import { providerMapToIcon } from '../provider-map-icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons';
import { NoAgentsInfo } from './no-agents-info';

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'model', label: 'Model', size: '10rem' },
  { name: 'entities', label: 'Entities', size: '6rem' },
];

export interface AgentListProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
}

export function AgentList({ agents, isLoading, error, onCreateClick }: AgentListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const agentData = useMemo(() => {
    return Object.values(agents ?? {});
  }, [agents]);

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

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter agents" placeholder="Filter by name or instructions" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(agent => {
                const agentsCount = Object.keys(agent.agents ?? {}).length;
                const toolsCount = Object.keys(agent.tools ?? {}).length;
                const workflowsCount = Object.keys(agent.workflows ?? {}).length;
                const instructions = extractPrompt(agent.instructions);
                const providerIcon = providerMapToIcon[agent.provider as keyof typeof providerMapToIcon] || null;

                return (
                  <ItemList.Row key={agent.id}>
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: agent.id }}
                      onClick={() => navigate(paths.agentLink(agent.id))}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid">
                        <span className="text-neutral4 text-ui-md truncate">{agent.name}</span>
                        {instructions && <span className="text-neutral2 text-ui-md truncate pr-6">{instructions}</span>}
                      </ItemList.TextCell>

                      <ItemList.Cell className="items-center gap-2 flex">
                        <span className="[&>svg]:w-4 [&>svg]:h-4 opacity-50">{providerIcon}</span>
                        <span className="truncate text-neutral3 text-ui-sm">{agent.modelId || 'N/A'}</span>
                      </ItemList.Cell>

                      <ItemList.Cell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ChipsGroup>
                              {agentsCount > 0 && (
                                <Chip intensity="muted">
                                  <AgentIcon /> {agentsCount}
                                </Chip>
                              )}
                              {workflowsCount > 0 && (
                                <Chip intensity="muted">
                                  <WorkflowIcon /> {workflowsCount}
                                </Chip>
                              )}
                              {toolsCount > 0 && (
                                <Chip intensity="muted">
                                  <ToolsIcon /> {toolsCount}
                                </Chip>
                              )}
                            </ChipsGroup>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex flex-col gap-1">
                              <strong>Attached Entities</strong>
                              {agentsCount > 0 && (
                                <span>
                                  {agentsCount} agent{agentsCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {workflowsCount > 0 && (
                                <span>
                                  {workflowsCount} workflow{workflowsCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {toolsCount > 0 && (
                                <span>
                                  {toolsCount} tool{toolsCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </ItemList.Cell>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
          </ItemList>
        )}
      </Column.Content>
    </Column>
  );
}
