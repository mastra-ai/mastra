import { framework } from '@/lib/framework-utils';

import { Connection } from './components/connection';

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
    <section className="relative">
      <h1 className="text-sm gradient capitalize border-b-[0.5px] py-2 border-primary-border p-4">Playground</h1>
      <div className="p-4 flex flex-col gap-4 mx-auto max-w-[40em]">
        <div className="">
          <h1 className="text-xl">Connected Integrations</h1>
          <p className="text-sm text-arkw-el-3">Explore events and apis for connected integrations</p>
        </div>
        <div className="grid grid-cols-4 max-w-72 gap-x-5 gap-3">
          {uniqueConnections.map(connection => {
            const apiCount = Object.keys(connection.apis)?.length;
            return <Connection key={connection.referenceId} name={connection.name} apiCount={apiCount} />;
          })}
        </div>
      </div>
    </section>
  );
}

export default Playground;
