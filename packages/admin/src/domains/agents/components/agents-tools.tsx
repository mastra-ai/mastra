import { IntegrationApi, getPineconeIndices } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

import KnowledgeSourceMultiSelect from './knowledge-source-multi-select';
import ToolChoiceRadio from './tool-choice';
import ToolsMultiSelect from './tools-multi-select';
import WorkflowsMultiSelect from './workflows-multi-select';

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

  const indexes = await getPineconeIndices();

  return (
    <section className="h-full">
      <h1 className="text-base py-4 font-medium ">Tools</h1>
      <section className="space-y-4 mt-1.5">
        <ToolsMultiSelect data={serializedFrameworkApis} />
        <WorkflowsMultiSelect />
        <KnowledgeSourceMultiSelect indexes={indexes || []} />
        <ToolChoiceRadio />
      </section>
    </section>
  );
};
