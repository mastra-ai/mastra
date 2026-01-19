import type { Task } from '@mastra/core';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { Icon } from '@/ds/icons/Icon';
import { DocsIcon } from '@/ds/icons/DocsIcon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns } from './columns';
import { TaskTableData } from './types';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';

export interface TasksTableProps {
  tasks: Task[];
  inboxId: string;
  isLoading: boolean;
  onTaskClick?: (task: Task) => void;
}

export function TasksTable({ tasks, inboxId, isLoading, onTaskClick }: TasksTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const tableData: TaskTableData[] = useMemo(() => tasks, [tasks]);

  const table = useReactTable({
    data: tableData,
    columns: columns as ColumnDef<TaskTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyTasksTable />;
  }

  const filteredRows = rows.filter(row => {
    const task = row.original;
    const searchLower = search.toLowerCase();
    return (
      task.title?.toLowerCase().includes(searchLower) ||
      task.type.toLowerCase().includes(searchLower) ||
      task.id.toLowerCase().includes(searchLower) ||
      task.sourceId?.toLowerCase().includes(searchLower)
    );
  });

  const handleRowClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else if (paths.taskLink) {
      navigate(paths.taskLink(inboxId, task.id));
    }
  };

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search tasks" placeholder="Search tasks" />
      </SearchbarWrapper>

      {isLoading ? (
        <TasksTableSkeleton />
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
                  <Row key={row.id} onClick={() => handleRowClick(row.original)}>
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

const TasksTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Task</Th>
      <Th>Status</Th>
      <Th>Priority</Th>
      <Th>Type</Th>
      <Th>Claimed By</Th>
      <Th>Created</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 5 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-3/4" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

const EmptyTasksTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<Inbox className="h-12 w-12 text-text3" />}
      titleSlot="No Tasks"
      descriptionSlot="No tasks in this inbox yet. Tasks will appear here when added."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/inbox/overview"
          target="_blank"
        >
          <Icon>
            <DocsIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
