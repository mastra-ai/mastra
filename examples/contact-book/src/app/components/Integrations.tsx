import { default as mastra } from '@mastra/config';

import { IntegrationToggle } from '@/components/IntegrationToggle';

import { getSession } from '@/app/actions/session';

export const Integrations = async () => {
  const router = mastra.createRouter();
  const sessionId = (await getSession())!;

  const integrations = mastra.availableIntegrations();
  const connections = await mastra.connectedIntegrations({
    context: {
      connectionId: sessionId,
    },
  });

  return (
    <div className="flex gap-4 items-center">
      {integrations.map(({ integration }) => (
        <IntegrationToggle
          key={integration.name}
          name={integration.name}
          logoUrl={integration.logoUrl}
          connectUrl={router.makeConnectURI({
            name: integration.name,
            connectionId: sessionId,
            clientRedirectPath: '/',
          })}
          connected={!!connections.find(connection => connection.name === integration.name)}
        />
      ))}
    </div>
  );
};
