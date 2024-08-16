
import { future } from '../../../../example.future.config';

import { ClientLayout } from './client-layout';

export default async function Integration({ params }: { params: { integration: string } }) {
  const dataIntegration = await future.dataLayer.getDataIntegrationByConnectionId({
    connectionId: `1`,
    name: params.integration.toUpperCase(),
  });

  if (!dataIntegration) {
    return null;
  }

  const syncTable = await future.dataLayer.getSyncTableRecordsByDataIdAndType({
    dataIntegrationId: dataIntegration?.id!,
    type: 'CONTACTS',
  });

  return (
    <ClientLayout
      integration={params.integration}
      fields={syncTable?.fields || []}
      data={syncTable?.records?.map(({ data }) => data) || []}
    />
  );
}
