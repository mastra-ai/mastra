import { IntegrationMap } from '@arkw/core/dist/generated-types';

import { framework } from '@/lib/framework-utils';

import { ClientLayout } from '.././[entityType]/client-layout';

export default async function Integration({ params }: { params: { integration: string; entityType: string } }) {
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const entityType = params.entityType.toUpperCase();
  const integration = framework?.getIntegration(String(integrationName));

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }
  const referenceId = `1`;

  const connection = await framework?.dataLayer.getConnectionByReferenceId({
    referenceId,
    name: String(integrationName),
  });

  if (!connection) {
    console.log(`Connection with referenceId ${referenceId} not found for ${params.integration}`);
    return null;
  }

  const syncTable = await framework?.dataLayer.getEntityRecordsByConnectionAndType({
    connectionId: connection?.id!,
    type: entityType,
  });

  return (
    <ClientLayout
      integration={params.integration}
      properties={syncTable?.properties || []}
      data={syncTable?.records?.map(({ data }) => data) || []}
      entityTypes={integration.entityTypes}
    />
  );
}
