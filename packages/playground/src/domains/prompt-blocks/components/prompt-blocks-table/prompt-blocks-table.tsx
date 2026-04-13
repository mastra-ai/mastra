import {
  Button,
  EmptyState,
  ScrollableContainer,
  Searchbar,
  SearchbarWrapper,
  Skeleton,
  Cell,
  Row,
  Table,
  Tbody,
  Th,
  Thead,
  useTableKeyboardNavigation,
} from '@mastra/playground-ui';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { FileTextIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { columns } from './columns';
import type { PromptBlockTableData } from './types';

import { useLinkComponent } from '@/lib/framework';

export interface PromptBlocksTableProps {
  promptBlocks: PromptBlockTableData[];
  isLoading: boolean;
}

export function PromptBlocksTable({ promptBlocks, isLoading }: PromptBlocksTableProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    const searchLower = search.toLowerCase();
    return promptBlocks.filter(
      b => b.name?.toLowerCase().includes(searchLower) || b.description?.toLowerCase().includes(searchLower),
    );
  }, [promptBlocks, search]);

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const block = filteredData[index];
      if (block) {
        navigate(paths.cmsPromptBlockEditLink(block.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  if (promptBlocks.length === 0 && !isLoading) {
    return <EmptyPromptBlocksTable />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search prompt blocks" placeholder="Search prompt blocks" />
      </SearchbarWrapper>
      {isLoading ? (
        <PromptBlocksTableSkeleton />
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
                  onClick={() => navigate(paths.cmsPromptBlockEditLink(row.original.id))}
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

const PromptBlocksTableSkeleton = () => (
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

const EmptyPromptBlocksTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<FileTextIcon className="h-8 w-8" />}
      titleSlot="No Prompt Blocks"
      descriptionSlot="Create reusable prompt blocks that can be referenced in your agent instructions."
      actionSlot={
        <Button as="a" href="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks" target="_blank">
          <FileTextIcon />
          Docs
        </Button>
      }
    />
  </div>
);
