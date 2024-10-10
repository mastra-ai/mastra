import { IntegrationApi } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

import ToolsMultiSelect from './tools-multi-select';

export const AgentTools = async () => {
  const systemApis = framework?.getSystemApis() || [];
  const connectedIntegrations = await framework?.dataLayer.getAllConnections();

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = connectedIntegrations?.reduce(
    (acc: any, { name }: any) => {
      const apis = framework?.getApisByIntegration(name);

      return { ...acc, ...apis };
    },
    {},
  );

  const allApis = { ...systemApis, ...availableIntegrationsApis };
  const frameworkApis = Object.values(allApis) as IntegrationApi[];

  const serializedFrameworkApis = await getSerializedFrameworkApis({
    frameworkApis,
    ctx: { connectionId: '' },
  });

  return (
    <section className=" space-y-2">
      <h1 className="font-medium text-sm">Tools:</h1>
      <ToolsMultiSelect data={serializedFrameworkApis} />
    </section>
  );
};
