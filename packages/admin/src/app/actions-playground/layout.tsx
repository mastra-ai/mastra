import { IntegrationAction } from '@arkw/core';
import { ReactNode } from 'react';

import { getFramework } from '@/lib/framework-utils';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const framework = await getFramework();
  const systemActions = framework?.getSystemActions() || [];
  const connectedIntegrations =
    (await framework?.connectedIntegrations({
      context: {
        referenceId: `1`,
      },
    })) || [];

  const connectedIntegrationsActions: Record<string, IntegrationAction<any>> = connectedIntegrations.reduce(
    (acc: any, { name }: any) => {
      const actions = framework?.getActionsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const allActions = { ...systemActions, ...connectedIntegrationsActions };

  const frameworkActions = Object.values(allActions) as IntegrationAction[];

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
