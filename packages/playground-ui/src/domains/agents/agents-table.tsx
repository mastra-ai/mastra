'use client';

import { AgentIcon } from '@/components/icons/agent-icon';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';

export const AgentsTable = ({
  title,
  agentsList,
  columns,
  isLoading,
}: {
  title?: React.ReactNode;
  agentsList: any[];
  columns: ColumnDef<any>[];
  isLoading?: boolean;
}) => {
  return (
    <DataTable
      emptyText="Agents"
      title={title}
      isLoading={isLoading}
      withoutBorder
      withoutRadius
      icon={<AgentIcon className="h-4 w-4" />}
      columns={columns}
      data={agentsList}
      className="!border-t-0 border-[0.5px] border-x-0"
    />
  );
};
