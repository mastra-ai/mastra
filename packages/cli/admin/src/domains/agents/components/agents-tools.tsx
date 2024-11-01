import { IntegrationApi } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

import ToolChoiceRadio from './tool-choice';
import ToolsMultiSelect from './tools-multi-select';
import VectorToolsMultiSelect from './vector-tools-multi-select';
import WorkflowToolsMultiSelect from './workflows-tools-multi-select';

export const AgentTools = async () => {
  const systemApis = framework?.getSystemApis() || {};
  const connectedIntegrations = await framework?.dataLayer.getAllConnections();

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = connectedIntegrations?.reduce(
    (acc: any, { name }: any) => {
      const apis = framework?.getApisByIntegration(name);

      return { ...acc, ...apis };
    },
    {},
  );

  const allApis = { ...systemApis, ...availableIntegrationsApis };
  const frameworkApis = (Object.values(allApis) as IntegrationApi[])?.filter(s => !s.source);

  const vectorApis = (Object.values(systemApis) as IntegrationApi[])?.filter(
    s => !!s.source && s.source !== 'WORKFLOW',
  );

  const workflowApis = (Object.values(systemApis) as IntegrationApi[])?.filter(s => s.source === 'WORKFLOW');

  const serializedFrameworkApis = await getSerializedFrameworkApis({
    frameworkApis,
    ctx: { connectionId: '' },
  });

  const serializedVectorApis = await getSerializedFrameworkApis({
    frameworkApis: vectorApis,
    ctx: { connectionId: '' },
  });

  const serializedWorkflowApis = await getSerializedFrameworkApis({
    frameworkApis: workflowApis,
    ctx: { connectionId: '' },
  });

  return (
    <section className="h-full">
      <h1 className="text-base py-4 font-medium ">Tools</h1>
      <section className="space-y-4 mt-1.5">
        <ToolsMultiSelect data={serializedFrameworkApis} />
        <WorkflowToolsMultiSelect data={serializedWorkflowApis} />
        <VectorToolsMultiSelect data={serializedVectorApis} />

        <ToolChoiceRadio />
      </section>
    </section>
  );
};
