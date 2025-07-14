'use client';

import { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { Cell, Row, Table, Tbody, Th, Thead } from '@/ds/components/Table';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Icon } from '@/ds/icons/Icon';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React from 'react';

import { ScrollableContainer } from '@/components/scrollable-container';
import { Skeleton } from '@/components/ui/skeleton';
import { columns } from './columns';
import { AgentTableData } from './types';

export interface AgentsTableProps {
  agents?: Record<string, GetAgentResponse>;
  isLoading: boolean;
  onClickRow: (agentId: string) => void;
}

export function AgentsTable({ agents, isLoading, onClickRow }: AgentsTableProps) {
  const _agents = agents || {};

  const projectData: AgentTableData[] = Object.keys(_agents).map(key => {
    const agent = _agents[key];

    return {
      id: key,
      name: agent.name,
      instructions: agent.instructions,
      provider: agent.provider,
      branch: undefined,
      executedAt: undefined,
      repoUrl: undefined,
      tools: agent.tools,
      modelId: agent.modelId,
    };
  });

  const table = useReactTable({
    data: projectData,
    columns: columns as ColumnDef<AgentTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <AgentsTableSkeleton />;

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0) {
    return <EmptyAgentsTable />;
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
            <Row key={row.id} onClick={() => onClickRow(row.original.id)}>
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

export const AgentsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th width={160}>Model</Th>
      <Th width={160}>Tools</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell width={160}>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
          <Cell width={160}>
            <Skeleton className="h-4 w-1/2" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);

export const EmptyAgentsTable = () => (
  <div className="flex h-full items-center justify-center">
    <EmptyState
      iconSlot={<AgentCoinIcon />}
      titleSlot="Configure Agents"
      descriptionSlot="Mastra agents are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/docs/agents/overview"
          target="_blank"
        >
          <Icon>
            <AgentIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  </div>
);
