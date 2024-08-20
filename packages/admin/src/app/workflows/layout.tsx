import type { IntegrationAction, IntegrationEvent } from '@arkw/core';
import { ReactNode } from 'react';

import { WorkflowProvider } from '@/domains/workflows/context/workflow-context';
import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';
import { getSerializedFrameworkActions, getSerializedFrameworkEvents } from '@/domains/workflows/utils';

import { future } from '../../../example.future.config';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemActions = future.getSystemActions();
  const systemEvents = future.getSystemEvents();

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
  const connectedIntegrationsEvents: Record<string, IntegrationEvent> = connectedIntegrations.reduce(
    (acc, { name }) => {
      const actions = future.getEventsByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const allActions = { ...systemActions, ...connectedIntegrationsActions };
  const allEvents = { ...systemEvents, ...connectedIntegrationsEvents };

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
