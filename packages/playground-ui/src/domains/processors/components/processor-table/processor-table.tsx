import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { Cell, Row, Table, Tbody, Th, Thead, useTableKeyboardNavigation } from '@/ds/components/Table';
import { is403ForbiddenError } from '@/lib/query-utils';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';

import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { Skeleton } from '@/ds/components/Skeleton';
import { columns } from './columns';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Searchbar, SearchbarWrapper } from '@/ds/components/Searchbar';
import type { ProcessorInfo } from '../../hooks/use-processors';

export interface ProcessorTableProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  error?: Error | null;
}

export type ProcessorRow = ProcessorInfo;

export function ProcessorTable({ processors, isLoading, error }: ProcessorTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const processorData = useMemo(() => {
    // Filter out processors that don't implement any phases
    return Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0);
  }, [processors]);

  const filteredData = useMemo(() => {
    const searchLower = search.toLowerCase();
    return processorData.filter(p => {
      const id = p.id.toLowerCase();
      const name = (p.name || '').toLowerCase();
      return id.includes(searchLower) || name.includes(searchLower);
    });
  }, [processorData, search]);

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const processor = filteredData[index];
      if (processor) {
        if (processor.isWorkflow) {
          navigate(paths.workflowLink(processor.id) + '/graph');
        } else {
          navigate(paths.processorLink(processor.id));
        }
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<ProcessorRow>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  // 403 check BEFORE empty state - permission denied takes precedence
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="processors" />
      </div>
    );
  }

  if (processorData.length === 0 && !isLoading) {
    return <EmptyProcessorsTable />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search processors" placeholder="Search processors" />
      </SearchbarWrapper>
      {isLoading ? (
        <ProcessorTableSkeleton />
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
                    onClick={() => {
                      // Workflow processors should navigate to the workflow graph UI
                      if (row.original.isWorkflow) {
                        navigate(paths.workflowLink(row.original.id) + '/graph');
                      } else {
                        navigate(paths.processorLink(row.original.id));
                      }
                    }}
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

const ProcessorTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Phases</Th>
      <Th>Used by</Th>
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

const EmptyProcessorsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<Cpu />}
      titleSlot="Configure Processors"
      descriptionSlot="No processors are configured yet. Add input or output processors to your agents to transform messages."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/docs/agents/processors"
          target="_blank"
        >
          <Icon>
            <Cpu />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
