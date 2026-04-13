import type { GetScorerResponse } from '@mastra/client-js';
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
  AgentCoinIcon,
  AgentIcon,
  Icon,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { columns } from './columns';
import type { ScorerTableData } from './types';

import { useLinkComponent } from '@/lib/framework';

export interface ScorersTableProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function ScorersTable({ scorers, isLoading, error }: ScorersTableProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const scorersData: ScorerTableData[] = useMemo(
    () =>
      Object.keys(scorers).map(key => {
        const scorer = scorers[key];

        return {
          ...scorer,
          id: key,
        };
      }),
    [scorers],
  );

  const filteredData = useMemo(() => {
    const searchLower = search.toLowerCase();
    return scorersData.filter(
      s =>
        s.scorer.config?.id?.toLowerCase().includes(searchLower) ||
        s.scorer.config?.name?.toLowerCase().includes(searchLower),
    );
  }, [scorersData, search]);

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const scorer = filteredData[index];
      if (scorer) {
        navigate(paths.scorerLink(scorer.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<ScorerTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  // 403 check BEFORE empty state - permission denied takes precedence
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="scorers" />
      </div>
    );
  }

  if (scorersData.length === 0 && !isLoading) {
    return <EmptyScorersTable />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search scorers" placeholder="Search scorers" />
      </SearchbarWrapper>
      {isLoading ? (
        <ScorersTableSkeleton />
      ) : (
        <ScrollableContainer>
          <Table>
            <Thead className="sticky top-0">
              {ths.headers.map(header => (
                <Th key={header.id} style={{ width: header.index === 0 ? 'auto' : header.column.getSize() }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Th>
              ))}
            </Thead>
            <Tbody>
              {rows.map((row, index) => (
                <Row
                  key={row.id}
                  isActive={index === activeIndex}
                  onClick={() => navigate(paths.scorerLink(row.original.id))}
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
        </ScrollableContainer>
      )}
    </div>
  );
}

const ScorersTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyScorersTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<AgentCoinIcon />}
      titleSlot="Configure Scorers"
      descriptionSlot="Mastra scorers are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/evals/overview"
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
