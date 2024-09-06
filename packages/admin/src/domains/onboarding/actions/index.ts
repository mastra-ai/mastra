'use server';

import { framework } from '@/lib/framework-utils';

export const getSyncedData = async ({
  referenceId,
  integrationName,
}: {
  referenceId: string;
  integrationName: string;
}) => {
  const integration = framework?.getIntegration(String(integrationName).toUpperCase());
  const entityTypes = integration?.entityTypes || {};
  let connectionId: string | undefined;
  const entityToRecordCountMap: Record<string, number> = {};

  if (referenceId) {
    const connection = await framework?.dataLayer.getConnectionByReferenceId({
      referenceId,
      name: String(integrationName.toUpperCase()),
    });
    connectionId = connection?.id;
  }

  if (connectionId) {
    const recordCount = await framework?.dataLayer.db.entity.findMany({
      where: {
        connectionId,
      },
      select: {
        type: true,
        records: true,
      },
    });

    recordCount?.reduce((acc, entity) => {
      acc[entity.type] = entity.records.length;
      return acc;
    }, entityToRecordCountMap);
  }

  return {
    entityTypes,
    entityToRecordCountMap,
  };
};
