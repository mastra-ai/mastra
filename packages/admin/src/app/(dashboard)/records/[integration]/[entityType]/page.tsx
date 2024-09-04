import { IntegrationMap } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

import { getReferenceIds } from '@/app/(dashboard)/actions';

import { ClientLayout } from '.././[entityType]/client-layout';

export default async function Integration({
  params,
  searchParams,
}: {
  params: { integration: string; entityType: string };
  searchParams: { referenceId?: string };
}) {
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const entityType = params.entityType.toUpperCase();
  const integration = framework?.getIntegration(String(integrationName));
  let referenceId = searchParams?.referenceId;

  const referenceIds = await getReferenceIds({ integrationName: integrationName as string });
  if (!referenceId) {
    referenceId = referenceIds?.[0]?.referenceId;
  }

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  if (!referenceId) {
    console.log(`ReferenceId not found for ${params.integration}`);
    return null;
  }

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
      referenceIds={referenceIds || []}
      referenceId={referenceId}
    />
  );
}
