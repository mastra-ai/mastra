import type { GetAgentResponse } from '@mastra/client-js';
import {
  Button,
  EmptyState,
  PermissionDenied,
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
  TooltipProvider,
  AgentCoinIcon,
  Icon,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { BookOpen, Plus } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useCanCreateAgent } from '../../hooks/use-can-create-agent';
import { getColumns } from './columns';
import type { AgentTableData } from './types';

import { useLinkComponent } from '@/lib/framework';

export interface AgentsTableProps {
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function AgentsTable({ agents, isLoading, error }: AgentsTableProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const projectData: AgentTableData[] = useMemo(() => Object.values(agents), [agents]);
  const columns = useMemo(() => getColumns(), []);
  const filteredData = useMemo(
    () => projectData.filter(agent => agent.name.toLowerCase().includes(search.toLowerCase())),
    [projectData, search],
  );

  const { activeIndex } = useTableKeyboardNavigation({
    itemCount: filteredData.length,
    global: true,
    onSelect: index => {
      const agent = filteredData[index];
      if (agent) {
        navigate(paths.agentLink(agent.id));
      }
    },
  });

  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<AgentTableData>[],
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

  // 403 check BEFORE empty state - permission denied takes precedence
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (projectData.length === 0 && !isLoading) {
    return <EmptyAgentsTable />;
  }

  return (
    <div>
      <SearchbarWrapper>
        <Searchbar onSearch={setSearch} label="Search agents" placeholder="Search agents" />
      </SearchbarWrapper>

      {isLoading ? (
        <AgentsTableSkeleton />
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
                    onClick={() => navigate(paths.agentLink(row.original.id))}
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

const AgentsTableSkeleton = () => (
  <Table>
    <Thead>
      <Th>Name</Th>
      <Th>Model</Th>
      <Th>Attached entities</Th>
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

const EmptyAgentsTable = () => {
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const createAgentPath = paths.cmsAgentCreateLink();
  const showCreateCta = canCreateAgent && Boolean(createAgentPath);

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<AgentCoinIcon />}
        titleSlot="No Agents Yet"
        descriptionSlot={
          showCreateCta
            ? 'Create your first agent or configure agents in code.'
            : 'Configure agents in code to get started.'
        }
        actionSlot={
          <div className="flex flex-col sm:flex-row gap-2">
            {showCreateCta && (
              <Button size="lg" variant="primary" as={FrameworkLink} to={createAgentPath}>
                <Icon>
                  <Plus />
                </Icon>
                Create an agent
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              as="a"
              href="https://mastra.ai/docs/agents/overview"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon>
                <BookOpen />
              </Icon>
              Documentation
            </Button>
          </div>
        }
      />
    </div>
  );
};
