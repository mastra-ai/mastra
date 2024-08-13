import { Prisma, PrismaClient, Record as PrismaRecord } from '@prisma/client';

export class DataLayer {
  db: PrismaClient;

  constructor({ db }: { db: PrismaClient }) {
    this.db = db;
  }

  async getConnectionById({
    connectionId,
    name,
  }: {
    name: string;
    connectionId: string;
  }) {
    return this.db.dataIntegration.findUnique({
      where: {
        connectionId_name: {
          connectionId,
          name,
        },
      },
    });
  }

  async getConnectionCredentialsById(connectionId: string) {
    return await this.db.dataIntegrationCredential.findUniqueOrThrow({
      where: {
        dataIntegrationId: connectionId,
      },
      include: {
        dataIntegration: true,
      },
    });
  }

  async getSyncTableById(syncTableId: string) {
    return await this.db.syncTable.findUniqueOrThrow({
      where: {
        id: syncTableId,
      },
    });
  }

  /**
   * Creates new records for a syncTable, or updates existing record 'data' if it already exists
   * @param syncTableIdß
   * @param records
   */
  async mergeExternalRecordsForSyncTable({
    syncTableId,
    records,
  }: {
    syncTableId: string;
    records: {
      externalId: string;
      data: Record<string, any>;
      ownerId: string;
      workspaceId: string;
      createdBy: string;
    }[];
  }) {
    const externalIds = records
      .filter((record) => record.externalId)
      .map((record) => record.externalId);
    const existingRecords = await this.db.record.findMany({
      select: {
        id: true,
        externalId: true,
        data: true,
      },
      where: {
        syncTableId,
        externalId: { in: externalIds },
      },
    });

    const toCreate: PrismaRecord[] = [];
    const toUpdate: PrismaRecord[] = [];
    records.forEach((record) => {
      const existing = existingRecords.find(
        (existingRecord) => existingRecord.externalId === record.externalId
      );
      if (existing) {
        toUpdate.push({
          ...record,
          // Merge-overwrite existing worksheetData
          data: {
            ...(existing.data as object),
            ...record.data,
          },
        } as unknown as PrismaRecord);
      } else {
        toCreate.push(record as unknown as PrismaRecord);
      }
    });

    return Promise.all([
      this.db.record.createMany({
        data: toCreate.map((record) => ({
          ...record,
          syncTableId,
          data: record.data as Prisma.JsonObject,
        })),
      }),
      toUpdate.length
        ? this.db.$executeRaw(
            Prisma.raw(`
          WITH values ("externalId", "data") as (
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
          SET "data" = values."data"
          FROM values
          WHERE records."externalId" = values."externalId";
        `)
          )
        : undefined,
    ]);
  }
}
