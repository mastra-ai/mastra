import type { GetAgentResponse } from '@mastra/client-js';
import type { ReactNode } from 'react';
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
  /** Built-in trailing columns to omit, for hosts whose agents have no workflows, sub-agents or code tools. */
  hiddenColumns?: AgentsListColumn[];
  /** Host-supplied trailing column. */
  extraColumn?: AgentsListExtraColumn;
}

export type AgentsListColumn = 'workflows' | 'agents' | 'tools';

export interface AgentsListExtraColumn {
  header: ReactNode;
  cell: (agent: GetAgentResponse) => ReactNode;
}

const NO_HIDDEN_COLUMNS: AgentsListColumn[] = [];

const nameSortByDirection = { asc: 'name-asc', desc: 'name-desc' } as const;
const directionByNameSort = { 'name-asc': 'asc', 'name-desc': 'desc', default: undefined } as const;

export function AgentsList({
  agents,
  isLoading,
  hasSearch,
  sort,
  onSortChange,
  hiddenColumns = NO_HIDDEN_COLUMNS,
  extraColumn,
}: AgentsListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({ count: agents.length, global: true });
  const show = (column: AgentsListColumn) => !hiddenColumns.includes(column);
  const trailingCount = 1 + (['workflows', 'agents', 'tools'] as const).filter(show).length + (extraColumn ? 1 : 0);
  const agentsListColumns = `minmax(12rem,20rem) minmax(0,1fr)${' auto'.repeat(trailingCount)}`;

  if (isLoading) {
    return <DataListSkeleton columns={agentsListColumns} fit="container" />;
  }

  return (
    <DataList columns={agentsListColumns} fit="container" scrollRef={containerRef}>
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
        {show('workflows') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <WorkflowIcon aria-hidden="true" />
              <span>Workflows</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
        {show('agents') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <AgentIcon aria-hidden="true" />
              <span>Agents</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
        {show('tools') ? (
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <ToolsIcon aria-hidden="true" />
              <span>Tools</span>
            </TextAndIcon>
          </DataList.TopCell>
        ) : null}
        {extraColumn ? <DataList.TopCell className="text-center">{extraColumn.header}</DataList.TopCell> : null}
      </DataList.Top>

      {agents.length === 0 && hasSearch ? <DataList.NoMatch message="No Agents match your search" /> : null}

      {agents.map((agent, index) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          rowProps={getRowProps(index)}
          showColumn={show}
          extraCell={extraColumn?.cell(agent)}
        />
      ))}
    </DataList>
  );
}
