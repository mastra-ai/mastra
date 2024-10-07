import React from 'react';

import { Header } from '@/app/components/header';
import { getAgents } from '@/domains/agents/actions';

import { Agents } from './agents';

const AgentsPage = async () => {
  const agents = await getAgents();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New agent" href="#" breadcrumbLabel="Agents" />
      </div>
      <Agents data={agents} />
    </div>
  );
};

export default AgentsPage;
