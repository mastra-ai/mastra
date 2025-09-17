import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { AgentNetworkCoinIcon } from '@/ds/icons/AgentNetworkCoinIcon';
import { Icon } from '@/ds/icons/Icon';
import { GetVNextNetworkResponse } from '@mastra/client-js';
import { NetworkIcon } from 'lucide-react';
import { NetworkTableColumn } from './types';
import { useMemo } from 'react';
import { ScrollableContainer } from '@/components/scrollable-container';
import { Table, Thead, Tbody, Th, Row, Cell } from '@/ds/components/Table';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface NetworkTableProps {
  networks: GetVNextNetworkResponse[];
  isLoading: boolean;
  computeLink: (networkId: string) => string;
}

export const NetworkTable = ({ networks, isLoading, computeLink }: NetworkTableProps) => {
  const { navigate } = useLinkComponent();
  const allNetworks: NetworkTableColumn[] = useMemo(
    () => [
      ...(networks?.map(network => ({
        ...network,
        routingModel: network.routingModel.modelId,
        agentsSize: network.agents.length,
        workflowsSize: network.workflows.length,
        toolsSize: network.tools.length,
      })) ?? []),
    ],
    [networks],
  );

  const table = useReactTable({
    data: allNetworks,
    columns: columns as ColumnDef<NetworkTableColumn>[],
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <NetworkTableSkeleton />;

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows.concat();

  if (rows.length === 0) {
    return <NetworkTableEmpty />;
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
            <Row key={row.id} onClick={() => navigate(computeLink(row.original.id))} className="cursor-pointer">
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
};

export const NetworkTableEmpty = () => {
  return (
    <EmptyState
      iconSlot={<AgentNetworkCoinIcon />}
      titleSlot="Configure Agent Networks"
      descriptionSlot="Mastra agent networks are not configured yet. You can find more information in the documentation."
      actionSlot={
        <Button
          size="lg"
          className="w-full"
          variant="light"
          as="a"
          href="https://mastra.ai/en/reference/networks/agent-network"
          target="_blank"
        >
          <Icon>
            <NetworkIcon />
          </Icon>
          Docs
        </Button>
      }
    />
  );
};

export const NetworkTableSkeleton = () => {
  return (
    <Table>
      <Thead>
        <Th>Name</Th>
        <Th width={160}>Agents</Th>
        <Th width={160}>Workflows</Th>
        <Th width={160}>Tools</Th>
        <Th width={160}>Routing Models</Th>
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
};
