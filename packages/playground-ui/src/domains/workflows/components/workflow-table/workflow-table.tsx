import { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';

import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { WorkflowTableData } from './types';
import { WorkflowCoinIcon, WorkflowIcon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';

export interface WorkflowTableProps {
  workflows: Record<string, GetWorkflowResponse>;
  storedWorkflows?: WorkflowTableData[];
  isLoading: boolean;
  isLoadingStored?: boolean;
}

export function WorkflowTable({ workflows, storedWorkflows = [], isLoading, isLoadingStored }: WorkflowTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  // Combine all workflows into a single list with type labels, sorted by type then name
  const workflowData: WorkflowTableData[] = useMemo(() => {
    const result: WorkflowTableData[] = [];

    // Add code-defined workflows
    Object.keys(workflows ?? {}).forEach(key => {
      const workflow = workflows[key as keyof typeof workflows];
      result.push({
        id: key,
        ...workflow,
        workflowType: workflow.isProcessorWorkflow ? 'processor' : 'code',
      });
    });

    // Add stored workflow definitions
    storedWorkflows.forEach(w => {
      result.push({
        ...w,
        workflowType: 'stored',
      });
    });

    // Sort by type (code, stored, processor) then alphabetically by name
    const typeOrder: Record<string, number> = { code: 0, stored: 1, processor: 2 };
    return result.sort((a, b) => {
      const typeA = a.workflowType || 'code';
      const typeB = b.workflowType || 'code';
      const typeCompare = typeOrder[typeA] - typeOrder[typeB];
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
  }, [workflows, storedWorkflows]);

  const table = useReactTable({
    data: workflowData,
    columns: columns as ColumnDef<WorkflowTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  const combinedLoading = isLoading || isLoadingStored;

  if (rows.length === 0 && !combinedLoading) {
    return <EmptyWorkflowsTable />;
  }

  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search workflows" placeholder="Search workflows" />
      </SearchbarWrapper>

      {combinedLoading ? (
        <WorkflowTableSkeleton />
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
                <Row key={row.id} onClick={() => navigate(paths.workflowLink(row.original.id))}>
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

const WorkflowTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th width={130}>Type</Th>
      <Th width={120}>Steps</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell width={130}>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell width={120}>
            <Skeleton className="h-4 w-16" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyWorkflowsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<WorkflowCoinIcon />}
      titleSlot="Configure Workflows"
      descriptionSlot="Mastra workflows are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/workflows/overview"
          target="_blank"
        >
          <Icon>
            <WorkflowIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
