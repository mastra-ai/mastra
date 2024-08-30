import type { IntegrationApi, RefinedIntegrationEvent } from '@arkw/core';
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

  const connectedIntegrationsEvents = connectedIntegrations.reduce<RefinedIntegrationEvent[]>((acc, { name }) => {
    const events = framework?.getEventsByIntegration(name) ?? {};
    const refinedEvents: RefinedIntegrationEvent[] = Object.entries(events).map(([k, v]) => {
      return {
        ...v,
        key: k,
        integrationName: name,
        label: k,
      };
    });
    return [...acc, ...refinedEvents];
  }, []);

  const refinedSystemEvents: RefinedIntegrationEvent[] = Object.entries(systemEvents ?? {}).map(([k, v]) => {
    return {
      ...v,
      key: k,
      integrationName: framework?.config.name,
    };
  });
  const frameworkEvents = [...refinedSystemEvents, ...connectedIntegrationsEvents];

  const allActions = { ...systemApis, ...connectedIntegrationsActions };
  const frameworkActions = Object.values(allActions) as IntegrationApi[];

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { referenceId: `1` },
  });

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
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
