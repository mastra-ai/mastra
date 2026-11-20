import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SettingsLayout } from '@mastra/playground-ui/new/settings';

import { InfrastructureOverview } from '@/domains/agent-builder/components/infrastructure/infrastructure-overview';

export const AgentBuilderInfrastructure = () => (
  <PageLayout
    actionRow={
      <ActionRow>
        <ActionRow.Start>
          <PageHeader>
            <PageHeader.Title>Infrastructure</PageHeader.Title>
            <PageHeader.Description>
              Deployment-level defaults Agent Builder applies when users create or run builder agents.
            </PageHeader.Description>
          </PageHeader>
        </ActionRow.Start>
      </ActionRow>
    }
  >
    <SettingsLayout>
      <InfrastructureOverview />
    </SettingsLayout>
  </PageLayout>
);

export default AgentBuilderInfrastructure;
