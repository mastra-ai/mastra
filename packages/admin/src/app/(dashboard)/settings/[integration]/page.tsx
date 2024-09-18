import { framework } from '@/lib/framework-utils';

import { Icon } from '@/app/components/icon';
import { IndividualIntegrationHeader } from '@/domains/integrations/components/individual-integration-header';

const IntegrationSetupPage = async ({ params }: { params: { integration: string } }) => {
  const integrationName = params.integration.toUpperCase();
  const integrationInstance = framework?.getIntegration(integrationName);
  const integrationLogoUrl = integrationInstance?.logoUrl;
  const connections = (await framework?.dataLayer.getConnectionsByIntegrationName({ name: integrationName as string }))
    ?.length;
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IndividualIntegrationHeader
          name={integrationName}
          logoUrl={integrationLogoUrl!}
          connections={connections!}
          headerButton={
            <div className="flex rounded bg-kpl-bg-6 gap-2 border-[0.5px] border-kpl-border-1 ml-auto px-2 py-1 text-xs text-kpl-el-4">
              <Icon name="book" className="text-current" />
              <span className="text-xs">Docs</span>
            </div>
          }
        />
      </div>
      <section className="flex h-full w-full overflow-hidden">
        <div className="grid grid-rows-[repeat(2,1fr)] gap-y-16 p-12 w-full flex-1 divide-y-[1px] border-kpl-border-2">
          <div className="top"></div>
          <div className="bottom"></div>
        </div>
        <aside className="border-l border-kpl-border-1 bg-kpl-bg-3 w-[30rem]"></aside>
      </section>
    </div>
  );
};

export default IntegrationSetupPage;
