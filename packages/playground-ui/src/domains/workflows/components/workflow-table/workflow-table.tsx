import { GetWorkflowResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { Cell, Row, Table, Tbody, Th, Thead, useTableKeyboardNavigation } from '@/ds/components/Table';
import { is403ForbiddenError } from '@/lib/query-utils';

import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns } from './columns';
import { WorkflowTableData } from './types';
import { WorkflowCoinIcon, WorkflowIcon } from '@/ds/icons';
import { useLinkComponent } from '@/lib/framework';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';

export interface WorkflowTableProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function WorkflowTable({ workflows, isLoading, error }: WorkflowTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const workflowData: WorkflowTableData[] = useMemo(() => {
    const _workflowsData = Object.keys(workflows ?? {}).map(key => {
      const workflow = workflows[key as keyof typeof workflows];

      return {
        id: key,
        ...workflow,
      };
    });

    return _workflowsData;
  }, [workflows]);

  const filteredData = useMemo(
    () => workflowData.filter(workflow => workflow.name.toLowerCase().includes(search.toLowerCase())),
    [workflowData, search],
  );

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const workflow = filteredData[index];
      if (workflow) {
        navigate(paths.workflowLink(workflow.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<WorkflowTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  // 403 check BEFORE empty state - permission denied takes precedence
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="workflows" />
      </div>
    );
  }

  if (workflowData.length === 0 && !isLoading) {
    return <EmptyWorkflowsTable />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search workflows" placeholder="Search workflows" />
      </SearchbarWrapper>

      {isLoading ? (
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
              {rows.map((row, index) => (
                <Row
                  key={row.id}
                  isActive={index === activeIndex}
                  onClick={() => navigate(paths.workflowLink(row.original.id))}
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

const WorkflowTableSkeleton = () => (
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
