import { IntegrationApi } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

import ToolsMultiSelect from './tools-multi-select';

export const AgentIntegrations = async () => {
  const systemApis = framework?.getSystemApis() || [];
  const connectedIntegrations = await framework?.dataLayer.getAllConnections();

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = connectedIntegrations?.reduce(
    (acc: any, { name }: any) => {
      const apis = framework?.getApisByIntegration(name);

      return { ...acc, ...apis };
    },
    {},
  );

  //fix: api not being returned for google
  console.log({ availableIntegrationsApis });

  const allApis = { ...systemApis, ...availableIntegrationsApis };
  const frameworkApis = Object.values(allApis) as IntegrationApi[];

  const serializedFrameworkApis = await getSerializedFrameworkApis({
    frameworkApis,
    ctx: { connectionId: '' },
  });

  return (
    <section className="px-[1.31rem] py-4 space-y-2">
      <h1 className="font-medium text-sm">Tools:</h1>
      <ToolsMultiSelect data={serializedFrameworkApis} />
    </section>
  );
};
