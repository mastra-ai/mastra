import React from 'react';

import { IntegrationHeader } from '@/domains/integrations/components/plugin-header';
import { IntegrationListRow } from '@/domains/integrations/components/plugin-list-row';

import { future } from '../../../example.future.config';

const integrationToSrcMap: Record<string, string> = {
  google: '/google.svg',
  notion: '/notion.svg',
  slack: '/slack.svg',
  rewatch: '/rewatch.svg',
  mailchimp: '/mailchimp.svg',
};

const IntegrationsPage = () => {
  const availableIntegrations = future.authenticatableIntegrations();
  const integrations = availableIntegrations.map(integration => {
    return {
      integrationName: integration.name,
      imgSrc: integrationToSrcMap[integration.name.toLowerCase()],
      integration: integration.integration,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <IntegrationHeader />
      </div>
      <div className="grow overflow-hidden">
        {integrations.map(({ integrationName, imgSrc, integration }) => {
          return <IntegrationListRow key={integration.name} integrationName={integrationName} imageSrc={imgSrc} />;
        })}
      </div>
    </div>
  );
};

export default IntegrationsPage;
