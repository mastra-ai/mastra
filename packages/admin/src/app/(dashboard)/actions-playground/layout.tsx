import { IntegrationApi } from '@arkw/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemApis = framework?.getSystemApis() || [];
  const connectedIntegrations =
    (await framework?.connectedIntegrations({
      context: {
        referenceId: `1`,
      },
    })) || [];

  const connectedIntegrationsActions: Record<string, IntegrationApi<any>> = connectedIntegrations.reduce(
    (acc: any, { name }: any) => {
      const apis = framework?.getApisByIntegration(name);
      return { ...acc, ...apis };
    },
    {},
  );

  const allActions = { ...systemApis, ...connectedIntegrationsActions };

  const frameworkActions = Object.values(allActions) as IntegrationApi[];

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { referenceId: '1' },
  });

  return (
    <ActionPlaygroundProvider serializedFrameworkActions={serializedFrameworkActions}>
      {children}
    </ActionPlaygroundProvider>
  );
}
