import { McpServerListResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';

import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useState } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';

import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/components/ui/tooltip';
import { McpCoinIcon, McpServerIcon } from '@/ds/icons';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';

export interface MCPTableProps {
  mcpServers: McpServerListResponse['servers'];
  isLoading: boolean;
}

export function MCPTable({ mcpServers, isLoading }: MCPTableProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const table = useReactTable({
    data: mcpServers,
    columns: columns as ColumnDef<McpServerListResponse['servers'][number]>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyMCPTable />;
  }

  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search MCP servers" placeholder="Search MCP servers" />
      </SearchbarWrapper>

      {isLoading ? (
        <MCPTableSkeleton />
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
                  <Row key={row.id} onClick={() => navigate(paths.mcpServerLink(row.original.id))}>
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

const MCPTableSkeleton = () => (
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

const EmptyMCPTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<McpCoinIcon />}
      titleSlot="Configure MCP servers"
      descriptionSlot="MCP servers are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/tools-mcp/mcp-overview"
          target="_blank"
        >
          <Icon>
            <McpServerIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
