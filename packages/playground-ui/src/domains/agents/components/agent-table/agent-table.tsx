import { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead, useTableKeyboardNavigation } from '@/ds/components/Table';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { Plus, BookOpen } from 'lucide-react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { getColumns } from './columns';
import { AgentTableData } from './types';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { useIsCmsAvailable } from '@/domains/cms';

export interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  onCreateClick?: () => void;
}

export function AgentsTable({ agents, isLoading, onCreateClick }: AgentsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const { isCmsAvailable } = useIsCmsAvailable();
  const projectData: AgentTableData[] = useMemo(() => Object.values(agents), [agents]);
  const columns = useMemo(() => getColumns(isCmsAvailable), [isCmsAvailable]);
  const filteredData = useMemo(
    () => projectData.filter(agent => agent.name.toLowerCase().includes(search.toLowerCase())),
    [projectData, search],
  );

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const agent = filteredData[index];
      if (agent) {
        navigate(paths.agentLink(agent.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<AgentTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  if (projectData.length === 0 && !isLoading) {
    return <EmptyAgentsTable onCreateClick={onCreateClick} />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search agents" placeholder="Search agents" />
      </SearchbarWrapper>

      {isLoading ? (
        <AgentsTableSkeleton />
      ) : (
        <ScrollableContainer>
          <TooltipProvider>
            <Table>
              <Thead className="sticky top-0">
                {ths.headers.map(header => (
                  <Th key={header.id} style={{ width: header.column.getSize() ?? 'auto' }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </Th>
                ))}
              </Thead>
              <Tbody>
                {rows.map((row, index) => (
                  <Row
                    key={row.id}
                    isActive={index === activeIndex}
                    onClick={() => navigate(paths.agentLink(row.original.id))}
                  >
                    {row.getVisibleCells().map(cell => (
                      <React.Fragment key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </React.Fragment>
                    ))}
                  </Row>
                ))}
              </Tbody>
            </Table>
          </TooltipProvider>
        </ScrollableContainer>
      )}
    </div>
  );
}

const AgentsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Model</Th>
      <Th>Attached entities</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

interface EmptyAgentsTableProps {
  onCreateClick?: () => void;
}

const EmptyAgentsTable = ({ onCreateClick }: EmptyAgentsTableProps) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<AgentCoinIcon />}
      titleSlot="No Agents Yet"
      descriptionSlot="Create your first agent or configure agents in code."
      actionSlot={
        <div className="flex flex-col sm:flex-row gap-2">
          {onCreateClick && (
            <Button size="lg" variant="light" onClick={onCreateClick}>
              <Icon>
                <Plus />
              </Icon>
              Create an agent
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            as="a"
            href="https://mastra.ai/docs/agents/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon>
              <BookOpen />
            </Icon>
            Documentation
          </Button>
        </div>
      }
    />
  </div>
);
