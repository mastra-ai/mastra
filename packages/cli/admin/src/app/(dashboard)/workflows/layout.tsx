import type { IntegrationApi, RefinedIntegrationEvent } from '@mastra/core';
import { ReactNode } from 'react';

import { framework } from '@/lib/framework-utils';

import { WorkflowProvider } from '@/domains/workflows/context/workflow-context';
import WorkflowsLayout from '@/domains/workflows/layouts/workflows-layout';
import { getSerializedFrameworkApis, getSerializedFrameworkEvents } from '@/domains/workflows/utils';

export default async function WorkflowsParentLayout({ children }: { children: ReactNode }) {
  const systemApis = framework?.getSystemApis();
  const systemEvents = framework?.getSystemEvents();

  const availableIntegrations = framework?.availableIntegrations()?.map(({ integration }) => integration) || [];

  const availableIntegrationsApis: Record<string, IntegrationApi<any>> = availableIntegrations.reduce(
    (acc, { name }) => {
      const actions = framework?.getApisByIntegration(name);
      return { ...acc, ...actions };
    },
    {},
  );

  const availableIntegrationsEvents = availableIntegrations.reduce<RefinedIntegrationEvent[]>((acc, { name }) => {
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

  const frameworkEvents = [...refinedSystemEvents, ...availableIntegrationsEvents];

  const allActions = { ...systemApis, ...availableIntegrationsApis };
  const frameworkApis = Object.values(allActions) as IntegrationApi[];

  const serializedFrameworkApis = await getSerializedFrameworkApis({
    frameworkApis,
    ctx: { connectionId: `` },
  });

  const serializedFrameworkEvents = await getSerializedFrameworkEvents({
    frameworkEvents,
    ctx: { connectionId: `` },
  });

  return (
    <WorkflowProvider
      serializedFrameworkApis={serializedFrameworkApis}
      serializedFrameworkEvents={serializedFrameworkEvents}
    >
      <WorkflowsLayout>{children}</WorkflowsLayout>
    </WorkflowProvider>
  );
}
