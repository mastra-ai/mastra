import React from 'react';

import { getAgents } from '@/domains/agents/actions';
import { AgentHeader } from '@/domains/agents/components/agents-header';

import { Agents } from './agents';

const AgentsPage = async () => {
  const agents = await getAgents();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AgentHeader />
      <Agents data={agents} />
    </div>
  );
};

export default AgentsPage;
