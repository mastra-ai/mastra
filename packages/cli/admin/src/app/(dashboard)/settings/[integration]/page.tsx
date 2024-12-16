import { Icon } from '@/components/icon';

import { IndividualIntegrationHeader } from '@/domains/integrations/components/individual-integration-header';
import { IntegrationButtonCode } from '@/domains/settings/components/integration-button-code';
import { IntegrationDetails } from '@/domains/settings/components/integration-details';
import { IntegrationSyncedData } from '@/domains/settings/components/integration-synced-data';

const IntegrationSetupPage = async (props: { params: Promise<{ integration: string }> }) => {
  const params = await props.params;
  const integrationName = params.integration.toUpperCase();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <IndividualIntegrationHeader
          name={integrationName}
          headerButton={
            <div className="flex rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1 ml-auto px-2 py-1 text-xs text-mastra-el-4">
              <Icon name="book" className="text-current" />
              <span className="text-xs">Docs</span>
            </div>
          }
        />
      </div>
      <section className="flex h-full w-full overflow-hidden">
        <div className="grid grid-rows-[repeat(2,1fr)] gap-y-8 p-12 w-full flex-1 divide-y-[1px] border-mastra-border-2">
          <IntegrationDetails integrationName={integrationName} />
          <div className="pt-8">
            <h2 className="text-mastra-el-6 text-lg font-medium capitalize">API Reference</h2>
          </div>
        </div>
        <aside className="border-l border-mastra-border-1 divide-y-[1px] bg-mastra-bg-3 w-[30rem]">
          <IntegrationSyncedData integrationName={integrationName} />
          <IntegrationButtonCode integrationName={integrationName} />
        </aside>
      </section>
    </div>
  );
};

export default IntegrationSetupPage;
