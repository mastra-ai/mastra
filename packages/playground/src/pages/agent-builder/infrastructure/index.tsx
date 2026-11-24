import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';

import { InfrastructureOverview } from '@/domains/agent-builder/components/infrastructure/infrastructure-overview';

export const AgentBuilderInfrastructure = () => (
  <PageLayout
    variant="settings"
    header={
      <PageHeader>
        <PageHeader.Title>Infrastructure</PageHeader.Title>
        <PageHeader.Description>
          Deployment-level defaults Agent Builder applies when users create or run builder agents.
        </PageHeader.Description>
      </PageHeader>
    }
  >
    <InfrastructureOverview />
  </PageLayout>
);

export default AgentBuilderInfrastructure;
