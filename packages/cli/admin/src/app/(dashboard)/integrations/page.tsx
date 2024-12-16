import { IntegrationCredentialType } from '@mastra/core';
import { Metadata } from 'next';
import zodToJsonSchema from 'zod-to-json-schema';

import { Header } from '@/components/header';

import { framework } from '@/lib/framework-utils';

import Integrations from './integrations';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Integrations',
  description: 'Integrations ...',
};

const IntegrationsPage = async () => {
  const availableIntegrations =
    framework?.authenticatableIntegrations()?.map(({ integration, name }) => {
      const APIKeyConnectionOptions = integration?.config?.authConnectionOptions;
      const serializedAPIKeyConnectionOptions = APIKeyConnectionOptions
        ? zodToJsonSchema(APIKeyConnectionOptions)
        : undefined;
      return {
        name,
        logoUrl: integration.logoUrl,
        isAPIKeyConnection: integration.getAuthenticator().config.AUTH_TYPE === IntegrationCredentialType.API_KEY,
        APIKeyConnectOptions: serializedAPIKeyConnectionOptions,
      };
    }) || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0">
        <Header linkText="New integration" href="/integrations/create" breadcrumbLabel="Integrations" />
      </div>
      <Integrations availableIntegrations={availableIntegrations} />
    </div>
  );
};

export default IntegrationsPage;
