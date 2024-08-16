import React from 'react';

import { future } from '../../../example.future.config';

import { IntegrationRow } from './client-row';

export default async function IntegrationPage() {
  const integrations = future.authenticatablePlugins();
  return (
    <div className="max-w-52">
      {integrations.map(integration => {
        return <IntegrationRow key={integration.name} name={integration.name} />;
      })}
    </div>
  );
}
