import type { Dataset } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useState } from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns, DatasetRow } from './columns';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import { DbIcon } from '@/ds/icons';
import { Plus } from 'lucide-react';
import { CreateDatasetDialog } from '../create-dataset-dialog';

export type DatasetTableProps = {
  datasets: Dataset[];
  isLoading: boolean;
};

export function DatasetTable({ datasets, isLoading }: DatasetTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const table = useReactTable({
    data: datasets,
    columns: columns as ColumnDef<DatasetRow>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyDatasetsTable />;
  }

  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search datasets" placeholder="Search datasets" />
      </SearchbarWrapper>
      {isLoading ? (
        <DatasetTableSkeleton />
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
                        navigate(paths.datasetLink(row.original.id));
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

const DatasetTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Created</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyDatasetsTable = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<DbIcon />}
        titleSlot="No Datasets"
        descriptionSlot="Create a dataset to store and manage your evaluation data."
        actionSlot={
          <Button size="lg" className="w-full" onClick={() => setDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Dataset
          </Button>
        }
      />
      <CreateDatasetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};
