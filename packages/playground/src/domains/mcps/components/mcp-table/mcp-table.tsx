import type { McpServerListResponse } from '@mastra/client-js';
import {
  Button,
  EmptyState,
  PermissionDenied,
  ScrollableContainer,
  Searchbar,
  SearchbarWrapper,
  Skeleton,
  Cell,
  Row,
  Table,
  Tbody,
  Th,
  Thead,
  useTableKeyboardNavigation,
  TooltipProvider,
  McpCoinIcon,
  McpServerIcon,
  Icon,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { columns } from './columns';

import { useLinkComponent } from '@/lib/framework';

export interface MCPTableProps {
  mcpServers: McpServerListResponse['servers'];
  isLoading: boolean;
  error?: Error | null;
}

export function MCPTable({ mcpServers, isLoading, error }: MCPTableProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');

  const filteredData = useMemo(
    () => mcpServers.filter(server => server.name.toLowerCase().includes(search.toLowerCase())),
    [mcpServers, search],
  );

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const server = filteredData[index];
      if (server) {
        navigate(paths.mcpServerLink(server.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<McpServerListResponse['servers'][number]>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  // 403 check BEFORE empty state - permission denied takes precedence
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="MCP servers" />
      </div>
    );
  }

  if (mcpServers.length === 0 && !isLoading) {
    return <EmptyMCPTable />;
  }

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
                {rows.map((row, index) => (
                  <Row
                    key={row.id}
                    isActive={index === activeIndex}
                    onClick={() => navigate(paths.mcpServerLink(row.original.id))}
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
