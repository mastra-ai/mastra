import { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { AgentTableData } from './types';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';

export interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
}

export function AgentsTable({ agents, isLoading }: AgentsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const projectData: AgentTableData[] = useMemo(() => Object.values(agents), [agents]);

  const table = useReactTable({
    data: projectData,
    columns: columns as ColumnDef<AgentTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyAgentsTable />;
  }

  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

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
                {filteredRows.map(row => (
                  <Row key={row.id} onClick={() => navigate(paths.agentLink(row.original.id))}>
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

const EmptyAgentsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<AgentCoinIcon />}
      titleSlot="Configure Agents"
      descriptionSlot="Mastra agents are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/agents/overview"
          target="_blank"
        >
          <Icon>
            <AgentIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
