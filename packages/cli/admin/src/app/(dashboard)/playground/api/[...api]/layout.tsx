import { IntegrationApi } from '@mastra/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { PlaygroundBreadCrumb } from '@/domains/playground/components/playground-breadcrumb';
import { ApiPlaygroundProvider } from '@/domains/playground/context/api-playground-context';
import { getSerializedFrameworkApis } from '@/domains/workflows/utils';

export default async function Layout(props: { children: ReactNode; params: Promise<{ api: Array<string> }> }) {
  const params = await props.params;

  const { children } = props;

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
    <div className="overflow-hidden">
      <nav className="text-sm h-fit capitalize border-b-[0.5px] py-2 border-mastra-border-1 p-4">
        <PlaygroundBreadCrumb />
      </nav>
      <ApiPlaygroundProvider serializedFrameworkApis={serializedFrameworkApis}>
        <section className="p-[0.62rem] bg-mastra-bg-1 h-[calc(100%-1.24rem)]">{children}</section>
      </ApiPlaygroundProvider>
    </div>
  );
}
