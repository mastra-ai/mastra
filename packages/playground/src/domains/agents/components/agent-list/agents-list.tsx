import type { GetAgentResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { AgentRow } from './agent-row';
import type { AgentsSort } from './agents-sort';

export interface AgentsListProps {
  agents: GetAgentResponse[];
  isLoading: boolean;
  hasSearch: boolean;
  sort: AgentsSort;
  onSortChange: (sort: AgentsSort) => void;
}

const agentsListColumns = 'minmax(12rem,20rem) minmax(0,1fr) auto auto auto auto';

const nameSortByDirection = { asc: 'name-asc', desc: 'name-desc' } as const;
const directionByNameSort = { 'name-asc': 'asc', 'name-desc': 'desc', default: undefined } as const;

export function AgentsList({ agents, isLoading, hasSearch, sort, onSortChange }: AgentsListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({ count: agents.length, global: true });

  if (isLoading) {
    return <EntityListSkeleton columns={agentsListColumns} fit="container" />;
  }

  return (
    <EntityList columns={agentsListColumns} fit="container" scrollRef={containerRef}>
      <EntityList.Top>
        <EntityList.SortableTopCell
          sortKey="name"
          sort={directionByNameSort[sort]}
          onSortChange={direction => onSortChange(nameSortByDirection[direction])}
        >
          Name
        </EntityList.SortableTopCell>
        <EntityList.TopCell>Purpose</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Provider</EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <WorkflowIcon aria-hidden="true" />
            <span>Workflows</span>
          </TextAndIcon>
        </EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <AgentIcon aria-hidden="true" />
            <span>Agents</span>
          </TextAndIcon>
        </EntityList.TopCell>
        <EntityList.TopCell className="text-center">
          <TextAndIcon className="justify-center">
            <ToolsIcon aria-hidden="true" />
            <span>Tools</span>
          </TextAndIcon>
        </EntityList.TopCell>
      </EntityList.Top>

      {agents.length === 0 && hasSearch ? <EntityList.NoMatch message="No Agents match your search" /> : null}

      {agents.map((agent, index) => (
        <AgentRow key={agent.id} agent={agent} rowProps={getRowProps(index)} />
      ))}
    </EntityList>
  );
}
