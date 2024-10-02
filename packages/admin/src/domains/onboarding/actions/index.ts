'use server';

import { Entity } from '@mastra/core';

import { framework } from '@/lib/framework-utils';

export const getEntities = async ({ integrationName, k_id }: { integrationName: string; k_id: string }) => {
  const integration = framework?.getIntegration(String(integrationName).toUpperCase());
  const entityTypes = integration?.entityTypes || {};
  const entities: Entity[] = [];

  await Promise.all(
    Object.keys(entityTypes).map(async entityType => {
      const entity = await framework?.dataLayer.getEntityByConnectionAndType({
        k_id,
        type: entityType,
      });
      if (entity) {
        entities.push(entity);
      }
    }),
  );

  return entities;
};

export const getSyncedData = async ({
  connectionId,
  integrationName,
}: {
  connectionId: string;
  integrationName: string;
}) => {
  const integration = framework?.getIntegration(String(integrationName).toUpperCase());
  const entityTypes = integration?.entityTypes || {};
  let k_id: string | undefined;
  const entityToRecordCountMap: Record<string, number> = {};

  if (connectionId) {
    const connection = await framework?.dataLayer.getConnection({
      connectionId,
      name: String(integrationName.toUpperCase()),
    });
    k_id = connection?.id;
  }

  if (k_id) {
    const recordCount = await framework?.dataLayer.db.entity.findMany({
      where: {
        k_id,
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
    connectionId,
    entityTypes,
    entityToRecordCountMap,
  };
};

export const getSyncedDataByEntity = async ({
  connectionId,
  integrationName,
  entityType,
}: {
  connectionId: string;
  integrationName: string;
  entityType: string;
}) => {
  let k_id: string | undefined;
  let recordCount: number | null = null;
  let lastSyncId: string | null = null;
  if (connectionId) {
    const connection = await framework?.dataLayer.getConnection({
      connectionId,
      name: String(integrationName.toUpperCase()),
    });
    k_id = connection?.id;
  }

  if (k_id) {
    const entity = await framework?.dataLayer.getEntityRecordsByConnectionAndType({
      k_id,
      type: entityType,
    });
    recordCount = entity?.records.length || 0;

    if (entity?.lastSyncId) {
      lastSyncId = entity.lastSyncId;
    }
  }

  return {
    recordCount,
    lastSyncId,
  };
};

export const watchEntityTypeStatusAction = async ({ lastSyncId }: { lastSyncId: string }) => {
  const event = await framework?.subscribeEvent({
    id: lastSyncId,
  });

  return event?.status;
};
