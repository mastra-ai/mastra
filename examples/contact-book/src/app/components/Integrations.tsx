import { default as arkw } from '@arkw/config';

import { getSession } from '@/app/actions/session';
import { IntegrationToggle } from '@/app/components/IntegrationToggle';

export const Integrations = async () => {
  const sessionId = (await getSession())!;

  const connections = await arkw.connectedIntegrations({
    context: {
      referenceId: sessionId,
    },
  });

  return (
    <div className="flex gap-4 items-center">
      {arkw.availableIntegrations().map(({ integration }) => (
        <IntegrationToggle
          key={integration.name}
          name={integration.name}
          logoUrl={integration.logoUrl}
          connectUrl={arkw.routes.connect}
          connectionId={sessionId}
        />
      ))}
    </div>
  );
};
