import type { IntegrationAction, IntegrationEvent } from '@arkw/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { WorkflowProvider } from '@/domains/workflows/context/workflow-context';
import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';
import { getSerializedFrameworkActions, getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemActions = framework?.getSystemActions();
  const systemEvents = framework?.getSystemEvents();

  const availableIntegrations = framework?.availableIntegrations()?.map(({ integration }) => integration) || [];

  const availableIntegrationsActions: Record<string, IntegrationAction<any>> = availableIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getActionsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );
  const availableIntegrationsEvents: Record<string, IntegrationEvent<any>> = availableIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getEventsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const allActions = { ...systemActions, ...availableIntegrationsActions };
  const allEvents = { ...systemEvents, ...availableIntegrationsEvents };

  const frameworkActions = Object.values(allActions) as IntegrationAction[];
  const frameworkEvents = Object.values(allEvents)
    ?.filter(({ triggerProperties }) => triggerProperties)
    ?.map(({ triggerProperties }) => triggerProperties!);

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
