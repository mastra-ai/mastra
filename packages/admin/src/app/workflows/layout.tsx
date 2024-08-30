import type { IntegrationApi, IntegrationEvent } from '@arkw/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { WorkflowProvider } from '@/domains/workflows/context/workflow-context';
import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';
import { getSerializedFrameworkActions, getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemApis = framework?.getSystemApis();
  const systemEvents = framework?.getSystemEvents();

  const connectedIntegrations =
    (await framework?.connectedIntegrations({
      context: {
        referenceId: `1`,
      },
    })) || [];

  const connectedIntegrationsActions: Record<string, IntegrationApi<any>> = connectedIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getApisByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );
  const connectedIntegrationsEvents: Record<string, IntegrationEvent<any>> = connectedIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getEventsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const allActions = { ...systemApis, ...connectedIntegrationsActions };

  const frameworkActions = Object.values(allActions) as IntegrationApi[];


  console.log(connectedIntegrationsEvents)

  const globalEvents = framework?.getGlobalEvents();

  const allEvents = Array.from(globalEvents?.entries() || []).flatMap(([intName, obj]) => {
    return Object.entries(obj).map(([k, v]) => {
      return {
        key: k,
        intName,
        ...v
      }
    })
  })

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { referenceId: `1` },
  });

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents: allEvents,
    ctx: { referenceId: `1` },
  });
  
  return (
    <WorkflowProvider
      serializedFrameworkActions={serializedFrameworkActions}
      serializedFrameworkEvents={serializedFrameworkEvents}
    >
      <WorkflowsLayout>{children}</WorkflowsLayout>
    </WorkflowProvider>
  );
}
