import { IntegrationApi } from '@kpl/core';
import { ReactNode } from 'react';


import { framework } from '@/lib/framework-utils';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';
import { PlaygroundBreadCrumb } from '../../components/playground-breadcrumb';

export default async function Layout({ params, children }: { children: ReactNode; params: { api: Array<string> } }) {

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

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions: frameworkApis,
    ctx: { referenceId: '' },
  });

  return (
    <div className="overflow-hidden">
      <nav className="text-sm h-fit capitalize border-b-[0.5px] py-2 border-kpl-border-1 p-4">
        <PlaygroundBreadCrumb />
      </nav>
      <ActionPlaygroundProvider serializedFrameworkActions={serializedFrameworkActions}>
        <section className="p-[0.62rem] bg-kpl-bg-1 h-[calc(100%-1.24rem)]">{children}</section>
      </ActionPlaygroundProvider>
    </div>
  );
}
