import { DatasetRecord } from '@mastra/client-js';
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
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';
import { DatabaseIcon } from 'lucide-react';

export interface DatasetsTableProps {
  datasets: DatasetRecord[];
  isLoading: boolean;
}

export function DatasetsTable({ datasets, isLoading }: DatasetsTableProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');

  const table = useReactTable({
    data: datasets,
    columns: columns as ColumnDef<DatasetRecord>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyDatasetsTable />;
  }

  const filteredRows = rows;

  return (
    <div>
      <SearchbarWrapper className="grid grid-cols-[1fr_auto] gap-4 items-center">
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
              {filteredRows.map(row => (
                <Row key={row.id} onClick={() => navigate(paths.datasetLink(row.original.id))}>
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

const EmptyDatasetsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<DatabaseIcon />}
      titleSlot="No Datasets"
      descriptionSlot="Mastra datasets are not configured yet. You can find more information in the documentation."
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
            <DatabaseIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
