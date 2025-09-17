import { GetScorerResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { ScorerTableData } from './types';
import { useLinkComponent } from '@/lib/framework';

export interface ScorersTableProps {
  scorers: Record<string, GetScorerResponse>;
  isLoading: boolean;
  computeScorerLink: (scorerId: string) => string;
}

export function ScorersTable({ scorers, isLoading, computeScorerLink }: ScorersTableProps) {
  const { navigate } = useLinkComponent();
  const scorersData: ScorerTableData[] = useMemo(
    () =>
      Object.keys(scorers).map(key => {
        const scorer = scorers[key];

        return {
          id: key,
          name: scorer.scorer.config.name,
          description: scorer.scorer.config.description,
        };
      }),
    [scorers],
  );

  const table = useReactTable({
    data: scorersData,
    columns: columns as ColumnDef<ScorerTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <ScorersTableSkeleton />;

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0) {
    return <EmptyScorersTable />;
  }

  return (
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
          {rows.map(row => (
            <Row key={row.id} onClick={() => navigate(computeScorerLink(row.original.id))}>
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
  );
}

export const ScorersTableSkeleton = () => (
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

export const EmptyScorersTable = () => (
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
          href="https://mastra.ai/en/docs/scorers/overview"
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
