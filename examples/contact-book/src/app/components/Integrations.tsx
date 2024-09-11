import { default as kepler } from '@kpl/config';

import { getSession } from '@/app/actions/session';
import { IntegrationToggle } from '@/app/components/IntegrationToggle';

export const Integrations = async () => {
  const sessionId = (await getSession())!;

  const integrations = kepler.availableIntegrations();
  const connections = await kepler.connectedIntegrations({
    context: {
      referenceId: sessionId,
    },
  });

  return (
    <div className="flex gap-4 items-center">
      {integrations.map(({ integration }) => (
        <IntegrationToggle
          key={integration.name}
          name={integration.name}
          logoUrl={integration.logoUrl}
          connectUrl={kepler.makeConnectURI({
            name: integration.name,
            referenceId: sessionId,
            clientRedirectPath: '/',
          })}
          connected={!!connections.find(connection => connection.name === integration.name)}
        />
      ))}
    </div>
  );
};
