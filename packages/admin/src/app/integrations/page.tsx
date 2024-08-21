import React from 'react';

import { IntegrationHeader } from '@/domains/integrations/components/integration-header';
import { IntegrationListRow } from '@/domains/integrations/components/integration-list-row';

import { future } from '../../../example.future.config';

const IntegrationsPage = () => {
  const availableIntegrations = future.authenticatableIntegrations();

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IntegrationHeader />
      </div>
      <div className="grow overflow-hidden">
        {availableIntegrations.map(({ name, integration }) => {
          return <IntegrationListRow key={name} integrationName={name} imageSrc={integration.logoUrl} />;
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
