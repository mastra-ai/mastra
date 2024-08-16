import { IntegrationAction } from 'core';
import { ReactNode } from 'react';

import { ActionPlaygroundProvider } from '@/domains/playground/providers/action-playground-provider';
import { getSerializedFrameworkActions } from '@/domains/workflows/utils';

import { future } from '../../../example.future.config';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemActions = future.getSystemActions();
  const connectedPlugins = await future.connectedPlugins({
    context: {
      connectionId: `1`,
    },
  });

  const connectedPluginsActions: Record<string, IntegrationAction<any>> = connectedPlugins.reduce((acc, { name }) => {
    const actions = future.getActionsByPlugin(name);
    return { ...acc, ...actions };
  }, {});

  const allActions = { ...systemActions, ...connectedPluginsActions };

  const frameworkActions = Object.values(allActions) as IntegrationAction[];

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { connectionId: '1' },
  });

  return (
    <ActionPlaygroundProvider serializedFrameworkActions={serializedFrameworkActions}>
      {children}
    </ActionPlaygroundProvider>
  );
}
