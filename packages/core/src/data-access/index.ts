import {
  Prisma,
  PrismaClient,
  Record as PrismaRecord,
} from '@prisma-app/client';

import { FilterObject } from '../lib/query-builder/types';
import { prisma } from '../prisma/client';
import { RecordService } from '../service/service.record';

export class DataLayer {
  db: PrismaClient;
  recordService: RecordService<typeof prisma>;

  constructor({ url }: { url: string; provider: string }) {
    this.db = prisma(url) as PrismaClient;
    this.recordService = new RecordService({ db: this.db as any });
  }


  /**
   * Creates new records for a entity, or updates existing record 'data' if it already exists
   * @param entityId
   * @param records
   */
  async mergeExternalRecordsForEntity({
    entityId,
    records,
  }: {
    entityId: string;
    records: {
      externalId: string;
      data: Record<string, any>;
      entityType?: string;
    }[];
  }) {
    if (!records?.length) return;

    const uniqueRecordsMap = new Map<string, (typeof records)[0]>();

    for (const record of records) {
      if (record.externalId && !uniqueRecordsMap.has(record.externalId)) {
        uniqueRecordsMap.set(record.externalId, record);
      }
    }

    const uniqueRecords = Array.from(uniqueRecordsMap.values());
    const externalIds = uniqueRecords.map((record) =>
      String(record.externalId)
    );

    const existingRecords = await this.db.record.findMany({
      select: {
        id: true,
        externalId: true,
        data: true,
      },
      where: {
        entityId,
        externalId: { in: externalIds },
      },
    });

    const toCreate: PrismaRecord[] = [];
    const toUpdate: PrismaRecord[] = [];

    uniqueRecords.forEach((record) => {
      const existing = existingRecords.find(
        (existingRecord) =>
          existingRecord.externalId === String(record.externalId)
      );

      if (existing) {
        toUpdate.push({
          ...record,
          data: {
            ...(existing.data as Object),
            ...record.data,
          },
        } as PrismaRecord);
      } else {
        toCreate.push({
          ...record,
          externalId: String(record.externalId),
          entityId,
        } as PrismaRecord);
      }
    });

    const createPromise = toCreate.length
      ? this.db.record.createMany({
          data: toCreate.map((record) => ({
            ...record,
            externalId: String(record.externalId),
            data: record.data as Prisma.JsonObject,
          })),
        })
      : undefined;

    const updatePromise = toUpdate.length
      ? this.db.$executeRaw(
          Prisma.raw(`
          WITH updated_records ("externalId", "data") AS (
            VALUES
            ${toUpdate
              .map(
                ({ externalId, data }) =>
                  `('${externalId}', '${JSON.stringify(data).replace(
                    /'/g,
                    "''"
                  )}'::jsonb)`
              )
              .join(',')}
          )
          UPDATE records
          SET "data" = updated_records."data"
          FROM updated_records
          WHERE records."externalId" = updated_records."externalId";
        `)
        )
      : undefined;

    return Promise.all([createPromise, updatePromise]);
  }



  async getRecords<T extends string | number | symbol>({
    entityType,
    k_id,
    filters,
    sort,
  }: {
    entityType: string;
    k_id: string;
    filters?: FilterObject<T>;
    sort?: string[];
  }) {
    const recordData = this.recordService.getFilteredRecords({
      entityType,
      k_id,
      filters,
      sort,
    });

    return recordData;
  }

  async syncData({
    connectionId,
    name,
    data,
    type,
    properties,
    lastSyncId,
  }: {
    name: string;
    properties: Prisma.PropertyCreateInput[];
    connectionId: string;
    data: any;
    type: string;
    lastSyncId?: string;
  }) {
    const dataInt = await this.getConnection({
      connectionId,
      name,
    });

    if (!dataInt) {
      throw new Error(`No connection found for ${name}`);
    }

    let existingEntity = await this.getEntityByConnectionAndType({
      k_id: dataInt?.id!,
      type,
    });

    if (!existingEntity) {
      existingEntity = await this.createEntity({
        k_id: dataInt?.id!,
        type,
        connectionId,
      });

      await this.addPropertiesToEntity({
        entityId: existingEntity?.id!,
        properties,
      });
    }

    await this.mergeExternalRecordsForEntity({
      entityId: existingEntity?.id!,
      records: data,
    });

    if (lastSyncId) {
      await this.updateEntityLastSyncId({
        entityId: existingEntity?.id!,
        syncId: lastSyncId,
      });
    }
  }


}
