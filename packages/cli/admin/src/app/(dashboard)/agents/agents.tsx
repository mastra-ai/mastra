'use client';

import AgentsTable from '@/domains/agents/components/agents-table/agents-table';
import { agentsTableColumns } from '@/domains/agents/components/agents-table/agents-table-columns';
import { Agent } from '@/service/service.agentWriter';

export const Agents = ({ data }: { data: Array<Agent> }) => {
  return <AgentsTable data={data} columns={agentsTableColumns} />;
};
