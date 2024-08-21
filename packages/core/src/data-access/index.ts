import {
  Prisma,
  PrismaClient,
  Connection,
  Credential,
  Record as PrismaRecord,
} from '@prisma-app/client';
import { CredentialValue } from '../types';
import { prisma } from '../prisma/client';

export class DataLayer {
  db: PrismaClient;

  constructor({ url }: { url: string; provider: string }) {
    this.db = prisma(url) as PrismaClient;
  }

  async createConnection({
    connection,
    credential,
  }: {
    connection: Prisma.ConnectionUncheckedCreateInput;
    credential: Omit<Prisma.CredentialUncheckedCreateInput, 'connectionId'>;
  }) {
    return this.db.connection.upsert({
      where: {
        referenceId_name: {
          referenceId: connection.referenceId,
          name: connection.name,
        },
      },
      create: {
        ...connection,
        credential: {
          create: credential,
        },
      },
      update: {
        ...connection,
        credential: {
          update: credential,
        },
      },
      include: {
        credential: true,
      },
    }) as unknown as Connection & {
      credential: Credential;
    };
  }

  async getConnectionByReferenceId({
    referenceId,
    name,
  }: {
    name: string;
    referenceId: string;
  }) {
    return this.db.connection.findUnique({
      where: {
        referenceId_name: {
          referenceId,
          name,
        },
      },
    });
  }

  async getConnectionById({ connectionId }: { connectionId: string }) {
    return this.db.connection.findUnique({
      where: {
        id: connectionId,
      },
    });
  }

  async getCredentialsByConnectionId(connectionId: string) {
    return await this.db.credential.findUniqueOrThrow({
      where: {
        connectionId,
      },
      include: {
        connection: true,
      },
    });
  }

  async updateConnectionCredential({
    connectionId,
    token,
  }: {
    connectionId: string;
    token: CredentialValue;
  }) {
    return this.db.credential.update({
      where: {
        connectionId,
      },
      data: {
        value: token,
      },
    });
  }

  async createEntity({
    connectionId,
    type,
    referenceId,
  }: {
    referenceId: string;
    type: string;
    connectionId: string;
  }) {
    return this.db.entity.create({
      data: {
        connectionId,
        type,
        createdBy: referenceId,
        lastSyncId: undefined,
      },
    });
  }

  async getEntityById(entityId: string) {
    return await this.db.entity.findUniqueOrThrow({
      where: {
        id: entityId,
      },
    });
  }

  async addPropertiesToEntity({
    entityId,
    properties,
  }: {
    entityId: string;
    properties: Prisma.PropertyCreateInput[];
  }) {
    return this.db.entity.update({
      where: {
        id: entityId,
      },
      data: {
        properties: {
          create: properties,
        },
      },
    });
  }

  async getEntityRecordsByConnectionAndType({
    connectionId,
    type,
  }: {
    connectionId: string;
    type: string;
  }) {
    return await this.db.entity.findUnique({
      where: {
        connectionId_type: {
          connectionId,
          type,
        },
      },
      include: {
        properties: true,
        records: true,
      },
    });
  }

  async getEntityByConnectionAndType({
    connectionId,
    type,
  }: {
    connectionId: string;
    type: string;
  }) {
    return await this.db.entity.findUnique({
      where: {
        connectionId_type: {
          connectionId,
          type,
        },
      },
    });
  }

  async updateEntityLastSyncId({
    entityId,
    syncId,
  }: {
    entityId: string;
    syncId: string;
  }) {
    return this.db.entity.update({
      where: {
        id: entityId,
      },
      data: {
        lastSyncId: syncId,
      },
    });
  }

  async deleteEntityById(entityId: string) {
    return this.db.entity.delete({
      where: {
        id: entityId,
      },
    });
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
      recordType?: string;
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
    const externalIds = uniqueRecords.map((record) => record.externalId);

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
        (existingRecord) => existingRecord.externalId === record.externalId
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
          entityId,
        } as PrismaRecord);
      }
    });

    const createPromise = toCreate.length
      ? this.db.record.createMany({
          data: toCreate.map((record) => ({
            ...record,
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

  async updateConnectionCredentials({
    connectionId,
    ...update
  }: Prisma.CredentialUpdateInput & { connectionId: string }) {
    return this.db.credential.update({
      where: {
        connectionId,
      },
      data: update,
    });
  }

  async getRecordByPropertyNameAndValues({
    propertyName,
    propertValues,
    type,
    referenceId,
  }: {
    propertyName: string;
    propertValues: string[];
    type?: string;
    referenceId: string;
  }) {
    const OR = propertValues.map((value) => ({
      data: {
        path: [propertyName],
        equals: value as any,
      },
    }));
    return this.db.record.findMany({
      where: {
        entity: {
          connection: {
            referenceId,
          },
          type,
        },
        OR,
      },
    });
  }

  async getRecordByPropertyNameAndValue({
    propertyName,
    propertyValue,
    type,
    referenceId,
  }: {
    propertyName: string;
    propertyValue: string;
    type: string;
    referenceId: string;
  }) {
    return this.db.record.findFirst({
      where: {
        entity: {
          connection: {
            referenceId,
          },
          type,
        },
        data: {
          path: [propertyName],
          equals: propertyValue,
        },
      },
    });
  }

  async getRecordsByPropertyName({
    propertyName,
    referenceId,
  }: {
    propertyName: string;
    referenceId: string;
  }) {
    return this.db.record.findMany({
      where: {
        entity: {
          connection: {
            referenceId,
          },
        },
        data: {
          path: [propertyName],
          not: Prisma.JsonNull,
        },
      },
    });
  }

  async setConnectionError({
    connectionId,
    error,
  }: {
    connectionId: string;
    error: string;
  }) {
    return await this.db.connection.update({
      where: {
        id: connectionId,
      },
      data: {
        issues: [error],
      },
    });
  }

  async setConnectionSubscriptionId({
    connectionId,
    subscriptionId,
  }: {
    connectionId: string;
    subscriptionId: string;
  }) {
    return await this.db.connection.update({
      where: {
        id: connectionId,
      },
      data: {
        subscriptionId,
      },
    });
  }

  async syncData({
    referenceId,
    name,
    data,
    type,
    properties,
  }: {
    name: string;
    properties: Prisma.PropertyCreateInput[];
    referenceId: string;
    data: any;
    type: string;
  }) {
    const dataInt = await this.getConnectionByReferenceId({
      referenceId,
      name,
    });

    let existingEntity = await this.getEntityByConnectionAndType({
      connectionId: dataInt?.id!,
      type,
    });

    if (!existingEntity) {
      existingEntity = await this.createEntity({
        connectionId: dataInt?.id!,
        type,
        referenceId,
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
  }

  async getConnectionsBySubscriptionId({
    subscriptionId,
  }: {
    subscriptionId: string;
  }) {
    return await this.db.connection.findMany({
      where: {
        subscriptionId,
      },
    });
  }
}
