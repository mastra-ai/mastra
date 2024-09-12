import { IntegrationApi } from '@kepler/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemApis = framework?.getSystemApis() || [];
  const availableIntegrations = framework?.availableIntegrations()?.map(({ integration }) => integration) || [];

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = availableIntegrations.reduce(
    (acc: any, { name }: any) => {
      const apis = framework?.getApisByIntegration(name);
      return { ...acc, ...apis };
    },
    {},
  );

  const allActions = { ...systemApis, ...availableIntegrationsApis };

  const frameworkActions = Object.values(allActions) as IntegrationApi[];

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { referenceId: '' },
  });

  return (
    <ActionPlaygroundProvider serializedFrameworkActions={serializedFrameworkActions}>
      {children}
    </ActionPlaygroundProvider>
  );
}
