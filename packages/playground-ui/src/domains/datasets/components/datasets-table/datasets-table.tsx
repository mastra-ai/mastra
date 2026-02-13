import type { DatasetRecord } from '@mastra/client-js';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns, DatasetTableColumn } from './columns';
import { useLinkComponent } from '@/lib/framework';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { EmptyDatasetsTable } from '../empty-datasets-table';

export interface DatasetsTableProps {
  datasets: DatasetRecord[];
  isLoading: boolean;
  onCreateClick?: () => void;
}

export function DatasetsTable({ datasets, isLoading, onCreateClick }: DatasetsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const tableData: DatasetTableColumn[] = useMemo(() => datasets, [datasets]);

  const table = useReactTable({
    data: tableData,
    columns: columns as ColumnDef<DatasetTableColumn>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  // Show empty state when no datasets and not loading
  if (rows.length === 0 && !isLoading) {
    return <EmptyDatasetsTable onCreateClick={onCreateClick} />;
  }

  // Filter rows by search term
  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search datasets" placeholder="Search datasets" />
      </SearchbarWrapper>

      {isLoading ? (
        <DatasetsTableSkeleton />
      ) : (
        <ScrollableContainer>
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

const DatasetsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Version</Th>
      <Th>Created</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);
