import { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';

import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { WorkflowTableData } from './types';
import { WorkflowCoinIcon, WorkflowIcon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';

export interface WorkflowTableProps {
  workflows?: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
}

export function WorkflowTable({ workflows, isLoading }: WorkflowTableProps) {
  const { navigate, paths } = useLinkComponent();
  const workflowData: WorkflowTableData[] = useMemo(() => {
    const _workflowsData = Object.keys(workflows ?? {}).map(key => {
      const workflow = workflows?.[key];

      return {
        id: key,
        name: workflow?.name || 'N/A',
        stepsCount: Object.keys(workflow?.steps ?? {})?.length,

        link: paths.workflowLink(key),
      };
    });

    return _workflowsData;
  }, [workflows]);

  const table = useReactTable({
    data: workflowData,
    columns: columns as ColumnDef<WorkflowTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <WorkflowTableSkeleton />;

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0) {
    return <EmptyWorkflowsTable />;
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
            <Row key={row.id} onClick={() => navigate(row.original.link)}>
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

export const WorkflowTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th width={300}>Steps</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell width={300}>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

export const EmptyWorkflowsTable = () => (
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
