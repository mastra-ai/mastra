import { ReactNode } from 'react';

import { WorkflowProvider } from '@/domains/workflows/context/workflow-context';
import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';
import { IntegrationAction, IntegrationEvent } from '@/domains/workflows/types';
import { getSerializedFrameworkActions, getSerializedFrameworkEvents } from '@/domains/workflows/utils';

import { future } from '../../../example.future.config';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemActions = future.getSystemActions();
  const systemEvents = future.getSystemEvents();

  const connectedPlugins = await future.connectedPlugins({
    context: {
      connectionId: `1`,
    },
  });

  const connectedPluginsActions: Record<string, IntegrationAction<any>> = connectedPlugins.reduce((acc, { name }) => {
    const actions = future.getActionsByPlugin(name);
    return { ...acc, ...actions };
  }, {});
  const connectedPluginsEvents: Record<string, IntegrationEvent> = connectedPlugins.reduce((acc, { name }) => {
    const actions = future.getEventsByPlugin(name);
    return { ...acc, ...actions };
  }, {});

  const allActions = { ...systemActions, ...connectedPluginsActions };
  const allEvents = { ...systemEvents, ...connectedPluginsEvents };

  const frameworkActions = Object.values(allActions) as IntegrationAction[];
  const frameworkEvents = Object.values(allEvents)
    ?.filter(({ triggerProperties }) => triggerProperties)
    ?.map(({ triggerProperties }) => triggerProperties!);

  const serializedFrameworkActions = await getSerializedFrameworkActions({
    frameworkActions,
    ctx: { connectionId: `1` },
  });
  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { connectionId: `1` },
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
