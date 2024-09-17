'use server';

import { Entity } from '@kpl/core';

import { framework } from '@/lib/framework-utils';

export const getEntities = async ({
  integrationName,
  connectionId,
}: {
  integrationName: string;
  connectionId: string;
}) => {
  const integration = framework?.getIntegration(String(integrationName).toUpperCase());
  const entityTypes = integration?.entityTypes || {};
  const entities: Entity[] = [];

  await Promise.all(
    Object.keys(entityTypes).map(async entityType => {
      const entity = await framework?.dataLayer.getEntityByConnectionAndType({
        connectionId,
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
    connectionId,
    entityTypes,
    entityToRecordCountMap,
  };
};

export const getSyncedDataByEntity = async ({
  referenceId,
  integrationName,
  entityType,
}: {
  referenceId: string;
  integrationName: string;
  entityType: string;
}) => {
  let connectionId: string | undefined;
  let recordCount: number | null = null;
  let lastSyncId: string | null = null;
  if (referenceId) {
    const connection = await framework?.dataLayer.getConnectionByReferenceId({
      referenceId,
      name: String(integrationName.toUpperCase()),
    });
    connectionId = connection?.id;
  }

  if (connectionId) {
    const entity = await framework?.dataLayer.getEntityRecordsByConnectionAndType({
      connectionId,
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
  const event = await framework?.watchEvent({
    id: lastSyncId,
  });

  return event?.status;
};
