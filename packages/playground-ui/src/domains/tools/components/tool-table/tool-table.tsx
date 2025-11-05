import { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';
import { ToolsIcon } from '@/ds/icons';
import { prepareToolsTable, ToolWithAgents } from '@/domains/tools/utils/prepareToolsTable';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';

export interface ToolTableProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
}

export function ToolTable({ tools, agents, isLoading }: ToolTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const toolData = useMemo(() => prepareToolsTable(tools, agents), [tools, agents]);

  const table = useReactTable({
    data: toolData,
    columns: columns as ColumnDef<ToolWithAgents>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyToolsTable />;
  }

  const filteredRows = rows.filter(row => row.original.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search tools" placeholder="Search tools" />
      </SearchbarWrapper>
      {isLoading ? (
        <ToolTableSkeleton />
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
                {filteredRows.map(row => {
                  return (
                    <Row
                      key={row.id}
                      onClick={() => {
                        navigate(paths.toolLink(row.original.id));
                      }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <React.Fragment key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </React.Fragment>
                      ))}
                    </Row>
                  );
                })}
              </Tbody>
            </Table>
          </TooltipProvider>
        </ScrollableContainer>
      )}
    </div>
  );
}

const ToolTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Used by</Th>
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
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyToolsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<ToolCoinIcon />}
      titleSlot="Configure Tools"
      descriptionSlot="Mastra tools are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/agents/using-tools-and-mcp"
          target="_blank"
        >
          <Icon>
            <ToolsIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
