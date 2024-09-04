import { IntegrationCredentialType } from '@arkw/core';
import React from 'react';
import zodToJsonSchema from 'zod-to-json-schema';

import { framework } from '@/lib/framework-utils';
import { cn } from '@/lib/utils';

import { IntegrationHeader } from '@/domains/integrations/components/integration-header';
import { IntegrationListRow } from '@/domains/integrations/components/integration-list-row';

const getOAuthConnectionRoute = async ({ name, referenceId }: { name: string; referenceId: string }) => {
  'use server';
  return await framework?.makeConnectURI({
    clientRedirectPath: `/records/${name.toLowerCase()}`,
    name: name,
    referenceId,
  });
};

const IntegrationsPage = async () => {
  const availableIntegrations = framework?.authenticatableIntegrations() || [];

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IntegrationHeader />
      </div>
      <div
        className={cn('grid gap-3 mx-auto mt-2 overflow-hidden', availableIntegrations.length > 1 ? 'grid-cols-2' : '')}
      >
        {availableIntegrations.map(({ name, integration }) => {
          const APIKeyConnectionOptions = integration?.config?.authConnectionOptions;
          const serializedAPIKeyConnectionOptions = APIKeyConnectionOptions
            ? zodToJsonSchema(APIKeyConnectionOptions)
            : undefined;

          return (
            <IntegrationListRow
              key={name}
              integrationName={name}
              imageSrc={integration.logoUrl}
              isAPIKeyConnection={integration.getAuthenticator().config.AUTH_TYPE === IntegrationCredentialType.API_KEY}
              APIKeyConnectOptions={serializedAPIKeyConnectionOptions}
              getOAuthConnectionRoute={getOAuthConnectionRoute}
            />
          );
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
