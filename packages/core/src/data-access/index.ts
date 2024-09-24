import {
  Prisma,
  PrismaClient,
  Connection,
  Credential,
  Record as PrismaRecord,
} from '@prisma-app/client';

import { FilterObject } from '../lib/query-builder/types';
import { prisma } from '../prisma/client';
import { RecordService } from '../service/service.record';
import { CredentialValue } from '../types';

export class DataLayer {
  db: PrismaClient;
  recordService: RecordService<typeof prisma>;

  constructor({ url }: { url: string; provider: string }) {
    this.db = prisma(url) as PrismaClient;
    this.recordService = new RecordService({ db: this.db as any });
  }

  async createConnection({
    connection,
    credential,
  }: {
    connection: Prisma.ConnectionUncheckedCreateInput;
    credential: Omit<Prisma.CredentialUncheckedCreateInput, 'k_id'>;
  }) {
    return this.db.connection.upsert({
      where: {
        connectionId_name: {
          connectionId: connection.connectionId,
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

  async deleteConnection({ connectionId }: { connectionId: string }) {
    return this.db.connection.delete({
      where: {
        id: connectionId,
      },
    });
  }

  async getConnection({
    connectionId,
    name,
  }: {
    name: string;
    connectionId: string;
  }) {
    return this.db.connection.findUnique({
      where: {
        connectionId_name: {
          connectionId,
          name,
        },
      },
    });
  }

  async getConnectionsByIntegrationName({ name }: { name: string }) {
    return this.db.connection.findMany({
      where: {
        name,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getAllConnections() {
    return this.db.connection.findMany({
      select: { name: true, connectionId: true },
    });
  }

  async getConnectionById({ k_id }: { k_id: string }) {
    return this.db.connection.findUnique({
      where: {
        id: k_id,
      },
    });
  }

  async getCredentialsByConnection(k_id: string) {
    return await this.db.credential.findUniqueOrThrow({
      where: {
        k_id,
      },
      include: {
        connection: true,
      },
    });
  }

  async updateConnectionCredential({
    k_id,
    token,
  }: {
    k_id: string;
    token: CredentialValue;
  }) {
    return this.db.credential.update({
      where: {
        k_id,
      },
      data: {
        value: token,
      },
    });
  }

  async createEntity({
    connectionId,
    type,
    k_id,
  }: {
    k_id: string;
    type: string;
    connectionId: string;
  }) {
    return this.db.entity.create({
      data: {
        k_id,
        type,
        createdBy: connectionId,
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
    k_id,
    type,
  }: {
    k_id: string;
    type: string;
  }) {
    return await this.db.entity.findUnique({
      where: {
        k_id_type: {
          k_id,
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
    k_id,
    type,
  }: {
    k_id: string;
    type: string;
  }) {
    return await this.db.entity.findUnique({
      where: {
        k_id_type: {
          k_id,
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
    k_id,
    ...update
  }: Prisma.CredentialUpdateInput & { k_id: string }) {
    return this.db.credential.update({
      where: {
        k_id,
      },
      data: update,
    });
  }

  async getRecords<T extends string | number | symbol>({
    entityType,
    connectionId,
    filters,
    sort,
  }: {
    entityType: string;
    connectionId: string;
    filters?: FilterObject<T>;
    sort?: string[];
  }) {
    const recordData = this.recordService.getFilteredRecords({
      entityType,
      connectionId,
      filters,
      sort,
    });

    return recordData;
  }

  async getRecordByPropertyNameAndValues({
    propertyName,
    propertValues,
    type,
    connectionId,
  }: {
    propertyName: string;
    propertValues: string[];
    type?: string;
    connectionId: string;
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
            connectionId,
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
    connectionId,
  }: {
    propertyName: string;
    propertyValue: string;
    type: string;
    connectionId: string;
  }) {
    return this.db.record.findFirst({
      where: {
        entity: {
          connection: {
            connectionId,
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
    connectionId,
  }: {
    propertyName: string;
    connectionId: string;
  }) {
    return this.db.record.findMany({
      where: {
        entity: {
          connection: {
            connectionId,
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
