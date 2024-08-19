import {
  Prisma,
  PrismaClient,
  DataIntegration,
  DataIntegrationCredential,
  Record as PrismaRecord,
} from '@prisma-app/client';
import { CredentialValue } from '../types';
import { prisma } from '../prisma/client';

export class DataLayer {
  db: PrismaClient;

  constructor({ url }: { url: string; provider: string }) {
    this.db = prisma(url) as PrismaClient;
  }

  async createDataIntegration({
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

  async getSyncTableRecordsByDataIdAndType({
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
      include: {
        fields: true,
        records: true,
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

  async deleteSyncTableById(syncTableId: string) {
    return this.db.syncTable.delete({
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
    }[];
  }) {
    const uniqueRecords = records?.reduce<
      {
        externalId: string;
        data: Record<string, any>;
      }[]
    >((acc, curr) => {
      if (!curr.externalId) return acc;

      if (acc?.find((i) => i.externalId === curr.externalId)) {
        return acc;
      }
      return [...acc, curr];
    }, []);

    const externalIds = uniqueRecords?.filter((record) => record?.externalId);

    const externalIdCheck =
      externalIds?.map((record) => record?.externalId)?.filter((id) => id) ||
      [];

    const existingRecords = await this.db.record.findMany({
      select: {
        id: true,
        externalId: true,
        data: true,
      },
      where: {
        syncTableId,
        externalId: { in: externalIdCheck },
      },
    });

    const toCreate: PrismaRecord[] = [];
    const toUpdate: PrismaRecord[] = [];

    uniqueRecords?.forEach((record) => {
      const existing = existingRecords.find(
        (existingRecord) => existingRecord.externalId === record.externalId
      );

      if (existing) {
        toUpdate.push({
          ...record,
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

  async getRecordByFieldNameAndValues({
    fieldName,
    fieldValues,
    type,
    connectionId,
  }: {
    fieldName: string;
    fieldValues: string[];
    type?: string;
    connectionId: string;
  }) {
    const OR = fieldValues.map((value) => ({
      data: {
        path: [fieldName],
        equals: value as any,
      },
    }));
    return this.db.record.findMany({
      where: {
        syncTable: {
          dataIntegration: {
            connectionId,
          },
          type,
        },
        OR,
      },
    });
  }

  async getRecordByFieldNameAndValue({
    fieldName,
    fieldValue,
    type,
    connectionId,
  }: {
    fieldName: string;
    fieldValue: string;
    type: string;
    connectionId: string;
  }) {
    return this.db.record.findFirst({
      where: {
        syncTable: {
          dataIntegration: {
            connectionId,
          },
          type,
        },
        data: {
          path: [fieldName],
          equals: fieldValue,
        },
      },
    });
  }

  async getRecordsByFieldName({
    fieldName,
    connectionId,
  }: {
    fieldName: string;
    connectionId: string;
  }) {
    return this.db.record.findMany({
      where: {
        syncTable: {
          dataIntegration: {
            connectionId,
          },
        },
        data: {
          path: [fieldName],
          not: Prisma.JsonNull,
        },
      },
    });
  }

  async setDataIntegrationError({
    dataIntegrationId,
    error,
  }: {
    dataIntegrationId: string;
    error: string;
  }) {
    return await this.db.dataIntegration.update({
      where: {
        id: dataIntegrationId,
      },
      data: {
        issues: [error],
      },
    });
  }

  async setDataIntegrationSubscriptionId({
    dataIntegrationId,
    subscriptionId,
  }: {
    dataIntegrationId: string;
    subscriptionId: string;
  }) {
    return await this.db.dataIntegration.update({
      where: {
        id: dataIntegrationId,
      },
      data: {
        subscriptionId,
      },
    });
  }

  async syncData({
    connectionId,
    name,
    data,
    type,
    fields,
  }: {
    name: string;
    fields: any;
    connectionId: string;
    data: any;
    type: string;
  }) {
    const dataInt = await this.getDataIntegrationByConnectionId({
      connectionId,
      name,
    });

    let existingSyncTable = await this.getSyncTableByDataIdAndType({
      dataIntegrationId: dataInt?.id!,
      type,
    });

    if (!existingSyncTable) {
      existingSyncTable = await this.createSyncTable({
        dataIntegrationId: dataInt?.id!,
        type,
        connectionId,
      });

      await this.addFieldsToSyncTable({
        syncTableId: existingSyncTable?.id!,
        fields,
      });
    }

    await this.mergeExternalRecordsForSyncTable({
      syncTableId: existingSyncTable?.id!,
      records: data,
    });
  }

  async getDataIntegrationsBySubscriptionId({
    subscriptionId,
  }: {
    subscriptionId: string;
  }) {
    return await this.db.dataIntegration.findMany({
      where: {
        subscriptionId,
      },
    });
  }
}
