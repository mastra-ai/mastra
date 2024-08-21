import { future } from '../../../../example.future.config';

import { ClientLayout } from './client-layout';

export default async function Integration({ params }: { params: { integration: string } }) {
  const connection = await future.dataLayer.getConnectionByReferenceId({
    referenceId: `1`,
    name: params.integration.toUpperCase(),
  });

  if (!connection) {
    return null;
  }

  const syncTable = await future.dataLayer.getEntityRecordsByConnectionAndType({
    connectionId: connection?.id!,
    type: 'CONTACTS',
  });

  const recordData = await future
    .getIntegration(params.integration.toUpperCase())
    ?.query({ referenceId: `1`, entityType: 'CONTACTS' });

  console.log({ recordData, int: params.integration, connection });

  return (
    <ClientLayout
      integration={params.integration}
      fields={syncTable?.properties || []}
      data={syncTable?.records?.map(({ data }) => data) || []}
    />
  );
}
