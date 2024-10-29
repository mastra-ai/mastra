import { Mastra, RefinedIntegrationEvent } from '@mastra/core';
import { Metadata } from 'next';

import { framework } from '@/lib/framework-utils';
import { sanitizeData } from '@/lib/sanitize-data';

import { ClientLayout } from './client-layout';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Playground ...',
};

function getApis(name: string, framework: Mastra | null) {
  if (!framework)
    return {
      integrationIcon: '',
      apis: {},
    };

  const apis = framework.getApisByIntegration(name);

  if (!apis)
    return {
      integrationIcon: '',
      apis: {},
    };

  const apisArr = Object.entries(apis);

  const firstItem = apisArr[0];

  if (!firstItem) {
    return { integrationIcon: '', apis };
  }

  const integrationIcon = firstItem[1]?.icon?.icon;
  if (!integrationIcon) {
    return { integrationIcon: '', apis };
  }

  return { integrationIcon, apis };
}

function getEventsForIntegration(integrationName: string, framework: Mastra | null) {
  if (!framework) return;

  const events = framework.getEventsByIntegration(integrationName) || {};
  const refinedEvents: RefinedIntegrationEvent[] = Object.entries(events).map(([key, value]) => {
    return {
      ...value,
      key,
      label: key,
      integrationName,
    };
  });
  return refinedEvents;
}
/**
 *
 * @param connectedIntegrations
 * @returns integration, apis, events, connection counts
 */
function getIntegrationWithConnectionAndApis(connectedIntegrations: Array<{ name: string; connectionId: string }>) {
  const connectionCount = connectedIntegrations.reduce((acc, integration) => {
    acc[integration.name] = (acc[integration.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return connectedIntegrations
    .reduce((acc: Array<{ name: string; connectionId: string } | undefined>, cur) => {
      const isPresent = acc.some(integration => integration?.name === cur?.name);
      if (!isPresent) {
        acc.push(cur);
      }
      return acc;
    }, [])
    .filter(integration => integration !== undefined)
    .map(integration => {
      const int = framework?.getIntegration(integration?.name!);
      const { apis, integrationIcon } = getApis(integration?.name!, framework);
      const installedIntegrations = framework?.authenticatableIntegrations();
      return {
        ...integration,
        icon: integrationIcon || int?.logoUrl,
        apis,
        connections: connectionCount[integration?.name!],
        events: getEventsForIntegration(integration?.name!, framework),
        isInstalled: installedIntegrations?.some(
          installedIntegration => installedIntegration.name === integration?.name,
        ),
      };
    })
    .filter(integration => integration !== undefined);
}

async function Playground() {
  const systemApis = framework?.getSystemApis();

  const systemEvents = framework?.getSystemEvents();

  const systemDetails = {
    name: 'system',
    apis: systemApis,
    events: systemEvents,
  };

  const connectedIntegrations =
    (await framework?.dataLayer.getAllConnections())?.filter(int => {
      return int?.name !== framework?.config?.name;
    }) || [];

  const updatedConnectedIntegration = [...getIntegrationWithConnectionAndApis(connectedIntegrations), systemDetails];

  return (
    <section className="relative overflow-y-scroll">
      <ClientLayout connectedIntegrations={sanitizeData(updatedConnectedIntegration)} />
    </section>
  );
}

export default Playground;
