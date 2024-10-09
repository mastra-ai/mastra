import { IntegrationApi } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

import ToolsMultiSelect from './tools-multi-select';

export const AgentIntegrations = async () => {
  const systemApis = framework?.getSystemApis() || [];
  const availableIntegrations = framework?.availableIntegrations()?.map(({ integration }) => integration) || [];

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = availableIntegrations.reduce(
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
    <div className="p-2 space-y-4">
      <h1 className="font-semibold">Tools</h1>
      <ToolsMultiSelect data={serializedFrameworkApis} />
    </div>
  );
};
