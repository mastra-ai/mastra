import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Badge } from '@/ds/components/Badge';
import { Cell, Row, Table, Tbody, Th, Thead, EntryCell, DateTimeCell } from '@/ds/components/Table';
import { WorkflowCoinIcon } from '@/ds/icons/WorkflowCoinIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, Row as TanStackRow } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { useLinkComponent } from '@/lib/framework';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Searchbar, SearchbarWrapper } from '@/components/ui/searchbar';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  stepGraph: unknown[];
  steps: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  source?: 'code' | 'stored';
}

export interface WorkflowDefinitionsTableProps {
  definitions: WorkflowDefinition[];
  onRowClick?: (definition: WorkflowDefinition) => void;
  onCreateClick?: () => void;
  isLoading?: boolean;
}

type WorkflowDefinitionTableColumn = {
  id: string;
} & WorkflowDefinition;

const NameCell = ({ row }: { row: TanStackRow<WorkflowDefinitionTableColumn> }) => {
  const { Link, paths } = useLinkComponent();

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.workflowLink(row.original.id)}>
          {row.original.name}
        </Link>
      }
      description={row.original.description}
    />
  );
};

const columns: ColumnDef<WorkflowDefinitionTableColumn>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Steps',
    accessorKey: 'steps',
    cell: ({ row }) => {
      const stepsCount = Object.keys(row.original.steps || {}).length;
      return (
        <Cell>
          <Badge variant="default">
            {stepsCount} step{stepsCount !== 1 ? 's' : ''}
          </Badge>
        </Cell>
      );
    },
  },
  {
    header: 'Source',
    accessorKey: 'source',
    cell: ({ row }) => {
      const source = row.original.source || 'code';
      return (
        <Cell>
          <Badge variant={source === 'stored' ? 'info' : 'default'}>{source}</Badge>
        </Cell>
      );
    },
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;
      if (!createdAt) {
        return <Cell>-</Cell>;
      }
      return <DateTimeCell dateTime={new Date(createdAt)} />;
    },
  },
];

export function WorkflowDefinitionsTable({
  definitions,
  onRowClick,
  onCreateClick,
  isLoading,
}: WorkflowDefinitionsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const tableData: WorkflowDefinitionTableColumn[] = useMemo(
    () =>
      definitions.map(def => ({
        ...def,
        id: def.id,
      })),
    [definitions],
  );

  const table = useReactTable({
    data: tableData,
    columns: columns as ColumnDef<WorkflowDefinitionTableColumn>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0 && !isLoading) {
    return <EmptyWorkflowDefinitionsTable onCreateClick={onCreateClick} />;
  }

  const filteredRows = rows.filter(row => row.original.name.toLowerCase().includes(search.toLowerCase()));

  const handleRowClick = (definition: WorkflowDefinition) => {
    if (onRowClick) {
      onRowClick(definition);
    } else {
      navigate(paths.workflowLink(definition.id));
    }
  };

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search workflow definitions" placeholder="Search workflow definitions" />
      </SearchbarWrapper>

      {isLoading ? (
        <WorkflowDefinitionsTableSkeleton />
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

const WorkflowDefinitionsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Steps</Th>
      <Th>Source</Th>
      <Th>Created</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

interface EmptyWorkflowDefinitionsTableProps {
  onCreateClick?: () => void;
}

const EmptyWorkflowDefinitionsTable = ({ onCreateClick }: EmptyWorkflowDefinitionsTableProps) => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<WorkflowCoinIcon />}
      titleSlot="Workflow Definitions"
      descriptionSlot="No workflow definitions found. Create one or configure workflows in your code."
      actionSlot={
        <div className="flex gap-2">
          {onCreateClick && (
            <Button size="lg" variant="light" onClick={onCreateClick}>
              <Icon>
                <WorkflowIcon />
              </Icon>
              Create Definition
            </Button>
          )}
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
        </div>
      }
    />
  </div>
);
