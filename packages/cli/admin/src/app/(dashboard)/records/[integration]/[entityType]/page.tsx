import { IntegrationMap } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

import { getConnectionIds } from '@/app/(dashboard)/actions';

import { ClientLayout } from '.././[entityType]/client-layout';

export default async function Integration(props: {
  params: Promise<{ integration: string; entityType: string }>;
  searchParams: Promise<{ connectionId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const entityType = params.entityType.toUpperCase();
  const integration = framework?.getIntegration(String(integrationName));
  let connectionId = searchParams?.connectionId;

  const connectionIds = await getConnectionIds({ integrationName: integrationName as string });
  if (!connectionId) {
    connectionId = connectionIds?.[0]?.connectionId;
  }

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  if (!connectionId) {
    console.log(`ConnectionId not found for ${params.integration}`);
    return null;
  }

  const connection = await framework?.dataLayer.getConnection({
    connectionId,
    name: String(integrationName),
  });

  if (!connection) {
    console.log(`Connection with connectionId ${connectionId} not found for ${params.integration}`);
    return null;
  }

  const syncTable = await framework?.dataLayer.getEntityRecordsByConnectionAndType({
    k_id: connection?.id!,
    type: entityType,
  });

  return (
    <ClientLayout
      integration={params.integration}
      properties={syncTable?.properties || []}
      data={syncTable?.records?.map(({ data }) => data) || []}
      connectionIds={connectionIds || []}
      connectionId={connectionId}
    />
  );
}
