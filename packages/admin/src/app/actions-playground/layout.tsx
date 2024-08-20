import { IntegrationAction } from '@arkw/core';
import { ReactNode } from 'react';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';

import { future } from '../../../example.future.config';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemActions = future.getSystemActions();
  const connectedIntegrations = await future.connectedIntegrations({
    context: {
      referenceId: `1`,
    },
  });

  const connectedIntegrationsActions: Record<string, IntegrationAction<any>> = connectedIntegrations.reduce(
    (acc, { name }) => {
      const actions = future.getActionsByIntegration(name);
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
