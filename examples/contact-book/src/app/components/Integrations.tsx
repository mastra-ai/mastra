import { IntegrationToggle } from '@/app/components/IntegrationToggle';
import arkw from '@/arkw.config';

export const Integrations = () => {
  // TODO: Need a way to query for connected integrations from arkw
  // const connections = arkw.dataLayer.getConnections();
  const connectionId = 'connectionId';

  return (
    <div className="flex gap-4 items-center">
      {arkw.availableIntegrations().map(({ integration }) => (
        <IntegrationToggle
          key={integration.name}
          name={integration.name}
          logoUrl={integration.logoUrl}
          connectUrl={arkw.routes.connect}
          connectionId={connectionId}
        />
      ))}
    </div>
  );
};
