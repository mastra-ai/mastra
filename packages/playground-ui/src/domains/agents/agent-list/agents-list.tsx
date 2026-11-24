import type { GetAgentResponse } from '@mastra/client-js';
import type { AgentCapability } from './agent-capabilities';
import { ALL_AGENT_CAPABILITIES } from './agent-capabilities';
import { AgentRow } from './agent-row';
import type { AgentsSort } from './agents-sort';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@/ds/components/DataList';
import { TextAndIcon } from '@/ds/components/Text';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

export interface AgentsListProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
  sort: AgentsSort;
  onSortChange: (sort: AgentsSort) => void;
  /** Composition columns to show. Defaults to workflows, agents and tools. */
  capabilities?: readonly AgentCapability[];
}

const agentsListColumns = (count: number) => `minmax(12rem,20rem) minmax(0,1fr) auto${' auto'.repeat(count)}`;

const nameSortByDirection = { asc: 'name-asc', desc: 'name-desc' } as const;
const directionByNameSort = { 'name-asc': 'asc', 'name-desc': 'desc', default: undefined } as const;

export function AgentsList({
  agents,
  isLoading,
  hasSearch,
  sort,
  onSortChange,
  capabilities = ALL_AGENT_CAPABILITIES,
}: AgentsListProps) {
  const columns = agentsListColumns(capabilities.length);
  const { containerRef, getRowProps } = useDataListKeyboard({ count: agents.length, global: true });

  if (isLoading) {
    return <DataListSkeleton columns={columns} fit="container" />;
  }

  return (
    <DataList columns={columns} fit="container" scrollRef={containerRef}>
      <DataList.Top>
        <DataList.SortableTopCell
          sortKey="name"
          sort={directionByNameSort[sort]}
          onSortChange={direction => onSortChange(nameSortByDirection[direction])}
        >
          Name
        </DataList.SortableTopCell>
        <DataList.TopCell>Purpose</DataList.TopCell>
        <DataList.TopCell className="text-center">Provider</DataList.TopCell>
        {capabilities.includes('workflows') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <WorkflowIcon aria-hidden="true" />
              <span>Workflows</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
        {capabilities.includes('agents') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <AgentIcon aria-hidden="true" />
              <span>Agents</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
        {capabilities.includes('tools') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <ToolsIcon aria-hidden="true" />
              <span>Tools</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
      </DataList.Top>

      {agents.length === 0 && hasSearch ? <DataList.NoMatch message="No Agents match your search" /> : null}

      {agents.map((agent, index) => (
        <AgentRow key={agent.id} agent={agent} rowProps={getRowProps(index)} capabilities={capabilities} />
      ))}
    </DataList>
  );
}
