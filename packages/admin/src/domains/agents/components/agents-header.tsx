import { Header } from '@/app/components/header';

import { AgentCreationForm } from './agent-creation-form';

export const AgentHeader = () => {
  return (
    <div className="sticky top-0">
      <Header linkText="New agent" href="#" breadcrumbLabel="Agents" withDialog>
        <AgentCreationForm />
      </Header>
    </div>
  );
};
