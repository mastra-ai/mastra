import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { SettingsLayout } from '@mastra/playground-ui/new/settings';

import { InfrastructureOverview } from '@/domains/agent-builder/components/infrastructure/infrastructure-overview';

export const AgentBuilderInfrastructure = () => (
  <SettingsLayout
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
  </SettingsLayout>
);

export default AgentBuilderInfrastructure;
