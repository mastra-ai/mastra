import { redirect } from 'next/navigation';

import { future } from '../../../../example.future.config';

export default async function Integration({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase();
  const integration = future.getIntegration(integrationName);

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  const indexEntityType = Object.values(integration.entityTypes)[0];

  if (indexEntityType) {
    redirect(`/records/${integrationName.toLowerCase()}/${indexEntityType.toLowerCase()}`);
  }

  return null;
}
