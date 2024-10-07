import React from 'react';

import { getAgents } from '@/domains/agents/actions';
import { Agent } from '@/domains/agents/components/agent';

const AgentsPage = async () => {
  const agents = await getAgents();
  return (
    <div>
      <Agent agents={agents} />
    </div>
  );
};

export default AgentsPage;
