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
   * Creates new records for a syncTable, or updates existing record 'data' if it already exists
   * @param syncTableIdß
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
        entityId,
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
          entityId,
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
