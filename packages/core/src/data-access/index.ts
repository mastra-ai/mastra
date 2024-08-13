import {
  Prisma,
  PrismaClient,
  DataIntegration,
  DataIntegrationCredential,
  Record as PrismaRecord,
  Field,
} from '@prisma/client';
import { CredentialValue } from '../types';

export class DataLayer {
  db: PrismaClient;

  constructor({ db }: { db: PrismaClient }) {
    this.db = db;
  }

  async createConnection({
    dataIntegration,
    credential,
  }: {
    dataIntegration: Prisma.DataIntegrationUncheckedCreateInput;
    credential: Omit<
      Prisma.DataIntegrationCredentialUncheckedCreateInput,
      'dataIntegrationId'
    >;
  }) {
    return this.db.dataIntegration.upsert({
      where: {
        connectionId_name: {
          connectionId: dataIntegration.connectionId,
          name: dataIntegration.name,
        },
      },
      create: {
        ...dataIntegration,
        credential: {
          create: credential,
        },
      },
      update: {
        ...dataIntegration,
        credential: {
          update: credential,
        },
      },
      include: {
        credential: true,
      },
    }) as unknown as DataIntegration & {
      credential: DataIntegrationCredential;
    };
  }

  async getDataIntegrationByConnectionId({
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

  async getDataIntegrationById({ integrationId }: { integrationId: string }) {
    return this.db.dataIntegration.findUnique({
      where: {
        id: integrationId,
      },
    });
  }

  async getDataIntegrationCredentialsById(integrationId: string) {
    return await this.db.dataIntegrationCredential.findUniqueOrThrow({
      where: {
        dataIntegrationId: integrationId,
      },
      include: {
        dataIntegration: true,
      },
    });
  }

  async updateDataIntegrationCredential({
    integrationId,
    token,
  }: {
    integrationId: string;
    token: CredentialValue;
  }) {
    return this.db.dataIntegrationCredential.update({
      where: {
        dataIntegrationId: integrationId,
      },
      data: {
        value: token,
      },
    });
  }

  async createSyncTable({
    dataIntegrationId,
    type,
    connectionId,
  }: {
    dataIntegrationId: string;
    type: string;
    connectionId: string;
  }) {
    return this.db.syncTable.create({
      data: {
        dataIntegrationId,
        type,
        createdBy: connectionId,
        lastSyncId: undefined,
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

  async addFieldsToSyncTable({
    syncTableId,
    fields,
  }: {
    syncTableId: string;
    fields: Prisma.FieldCreateInput[];
  }) {
    return this.db.syncTable.update({
      where: {
        id: syncTableId,
      },
      data: {
        fields: {
          create: fields,
        },
      },
    });
  }

  async getSyncTableByDataIdAndType({
    dataIntegrationId,
    type,
  }: {
    dataIntegrationId: string;
    type: string;
  }) {
    return await this.db.syncTable.findUnique({
      where: {
        dataIntegrationId_type: {
          dataIntegrationId,
          type,
        },
      },
    });
  }

  async updateSyncTableLastSyncId({
    syncTableId,
    syncId,
  }: {
    syncTableId: string;
    syncId: string;
  }) {
    return this.db.syncTable.update({
      where: {
        id: syncTableId,
      },
      data: {
        lastSyncId: syncId,
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

  async getConnectionCredentials(connectionId: string) {
    return this.db.dataIntegrationCredential.findUniqueOrThrow({
      where: {
        id: connectionId,
      },
      include: {
        dataIntegration: true,
      },
    });
  }

  async updateConnectionCredentials({
    connectionId,
    ...update
  }: Prisma.DataIntegrationCredentialUpdateInput & { connectionId: string }) {
    return this.db.dataIntegrationCredential.update({
      where: {
        dataIntegrationId: connectionId,
      },
      data: update,
    });
  }
}
