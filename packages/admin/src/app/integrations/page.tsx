import { IntegrationCredentialType } from '@arkw/core';
import React from 'react';
import zodToJsonSchema from 'zod-to-json-schema';

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
      <div className="grow overflow-hidden">
        {availableIntegrations.map(({ name, integration }) => {
          const OAuthConnectionRoute = framework?.makeConnectURI({
            clientRedirectPath: `/records/${name.toLowerCase()}`,
            name: name,
            referenceId,
          });

          const APIKeyConnectionOptions = integration?.config?.authConnectionOptions;
          const serializedAPIKeyConnectionOptions = APIKeyConnectionOptions
            ? zodToJsonSchema(APIKeyConnectionOptions)
            : undefined;

          return (
            <IntegrationListRow
              key={name}
              integrationName={name}
              imageSrc={integration.logoUrl}
              OAuthConnectionRoute={OAuthConnectionRoute ?? ''}
              isAPIKeyConnection={integration.getAuthenticator().config.AUTH_TYPE === IntegrationCredentialType.API_KEY}
              APIKeyConnectOptions={serializedAPIKeyConnectionOptions}
              referenceId={referenceId}
            />
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
