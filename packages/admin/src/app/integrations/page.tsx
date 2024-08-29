import { IntegrationCredentialType } from '@arkw/core';
import React from 'react';
import superjson from 'superjson';

import { framework } from '@/lib/framework-utils';

import { IntegrationHeader } from '@/domains/integrations/components/integration-header';
import { IntegrationListRow } from '@/domains/integrations/components/integration-list-row';

const IntegrationsPage = async () => {
  const availableIntegrations = framework?.authenticatableIntegrations() || [];

  const referenceId = '1';

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IntegrationHeader />
      </div>
      <div className="grid gap-3 mx-auto grid-cols-2 mt-2 overflow-hidden">
        {availableIntegrations.map(({ name, integration }) => {
          const OAuthConnectionRoute = framework?.makeConnectURI({
            clientRedirectPath: `/records/${name.toLowerCase()}`,
            name: name,
            referenceId,
          });
          return (
            <IntegrationListRow
              key={name}
              integrationName={name}
              imageSrc={integration.logoUrl}
              OAuthConnectionRoute={OAuthConnectionRoute ?? ''}
              isAPIKeyConnection={integration.getAuthenticator().config.AUTH_TYPE === IntegrationCredentialType.API_KEY}
              APIKeyConnectOptions={superjson.stringify({ data: integration.config.authConnectionOptions })}
            />
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
