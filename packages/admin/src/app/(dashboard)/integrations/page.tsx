import { IntegrationCredentialType } from '@kpl/core';
import React from 'react';
import zodToJsonSchema from 'zod-to-json-schema';

import { framework } from '@/lib/framework-utils';

import { IntegrationHeader } from '@/domains/integrations/components/integration-header';

import Integrations from './integrations';

const IntegrationsPage = () => {
  const availableIntegrations =
    framework?.authenticatableIntegrations()?.map(({ integration, name }) => {
      const APIKeyConnectionOptions = integration?.config?.authConnectionOptions;
      const serializedAPIKeyConnectionOptions = APIKeyConnectionOptions
        ? zodToJsonSchema(APIKeyConnectionOptions)
        : undefined;
      return {
        name,
        logoUrl: integration.logoUrl,
        connections: integration.dataLayer?.getAllConnections(),
        isAPIKeyConnection: integration.getAuthenticator().config.AUTH_TYPE === IntegrationCredentialType.API_KEY,
        APIKeyConnectOptions: serializedAPIKeyConnectionOptions,
      };
    }) || [];

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IntegrationHeader />
      </div>
      <Integrations availableIntegrations={availableIntegrations} />
    </div>
  );
};

export default IntegrationsPage;
