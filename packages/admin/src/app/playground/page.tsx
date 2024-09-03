import { framework } from '@/lib/framework-utils';
import { sanitizeData } from '@/lib/sanitize-data';

import { ClientLayout } from './client-layout';

async function Playground() {
  const connections = (await framework?.dataLayer.getAllConnections()) || [];

  //create object with unique referenceID
  const uniqueReferenceId =
    connections?.reduce((acc: { [key: string]: string }, curr) => {
      if (!acc[curr.name]) {
        acc[curr.name] = curr.referenceId;
      }
      return acc;
    }, {}) || {};

  const integrationApis = {} as Record<string, any>;

  for (const integrationName in uniqueReferenceId) {
    const apis = framework?.getActionsByIntegration(integrationName);
    integrationApis[integrationName] = apis;
  }

  const connectionsWithAPis = connections
    .map(connection => {
      if (integrationApis[connection.name]) {
        return { ...connection, apis: integrationApis[connection.name] };
      }
    })
    .filter(connection => connection !== undefined);

  const uniqueConnections = connectionsWithAPis
    .reduce((acc: Array<{ name: string; apis: any; referenceId: string } | undefined>, cur) => {
      const isPresent = acc.some(integration => integration?.name === cur?.name);
      if (!isPresent) {
        acc.push(cur);
      }
      return acc;
    }, [])
    .filter(connection => connection !== undefined);

  return (
    <section className="relative grid grid-cols-[23.5rem_1fr]">
      <ClientLayout connectedIntegration={sanitizeData(uniqueConnections)} />
    </section>
  );
}

export default Playground;
