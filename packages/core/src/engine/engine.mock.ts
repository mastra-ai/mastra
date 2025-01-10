import { MastraEngine, DatabaseConfig } from './engine';
import { BaseEntity, BaseRecord, QueryOptions } from './types';

export class MockMastraEngine extends MastraEngine {
  private entities: BaseEntity[] = [];
  private records: BaseRecord[] = [];

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async createEntity(params: { name: string; connectionId: string }): Promise<BaseEntity> {
    const entity: BaseEntity = {
      id: `entity_${Date.now()}`,
      name: params.name,
      connectionId: params.connectionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncId: null,
    };
    this.entities.push(entity);
    return entity;
  }

  async getEntityById(params: { id: string }): Promise<BaseEntity> {
    const entity = this.entities.find(e => e.id === params.id);
    if (!entity) {
      throw new Error(`Entity with id ${params.id} not found`);
    }
    return entity;
  }

  async getEntity({ connectionId, name }: { name?: string; connectionId?: string }): Promise<BaseEntity | undefined> {
    return this.entities.find(
      e => (name ? e.name === name : true) && (connectionId ? e.connectionId === connectionId : true),
    );
  }

  async deleteEntityById({ id }: { id: string }): Promise<BaseEntity> {
    const entityIndex = this.entities.findIndex(e => e.id === id);
    if (entityIndex === -1) {
      throw new Error(`Entity with id ${id} not found`);
    }
    const [deletedEntity] = this.entities.splice(entityIndex, 1);
    // Also delete associated records
    this.records = this.records.filter(r => r.entityId !== id);

    return deletedEntity!;
  }

  async upsertRecords(params: {
    entityId: string;
    records: Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>[];
  }): Promise<void> {
    await this.getEntityById({ id: params.entityId });

    for (const record of params.records) {
      const existingRecordIndex = this.records.findIndex(
        r => r.entityId === params.entityId && r.externalId === record.externalId,
      );

      const fullRecord: BaseRecord = {
        id: `record_${Date.now()}_${Math.random()}`,
        entityId: params.entityId,
        externalId: record.externalId,
        data: record.data,
        entityType: record.entityType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingRecordIndex !== -1) {
        this.records[existingRecordIndex] = fullRecord;
      } else {
        this.records.push(fullRecord);
      }
    }
  }

  async getRecordsByEntityId(params: { entityId: string }): Promise<BaseRecord[]> {
    return this.records.filter(r => r.entityId === params.entityId);
  }

  async getRecordsByEntityNameAndExternalId({
    entityName,
    connectionId,
    externalId,
  }: {
    entityName: string;
    connectionId: string;
    externalId: string;
  }): Promise<BaseRecord[]> {
    const entity = await this.getEntity({ name: entityName, connectionId });
    if (!entity) {
      return [];
    }
    return this.records.filter(r => r.entityId === entity.id && r.externalId === externalId);
  }

  async getRecordsByEntityName({ name, connectionId }: { name: string; connectionId: string }): Promise<BaseRecord[]> {
    const entity = await this.getEntity({ name, connectionId });
    if (!entity) {
      return [];
    }
    return this.getRecordsByEntityId({ entityId: entity.id });
  }

  async getRecords({
    entityName,
    connectionId,
    options,
  }: {
    entityName: string;
    options: QueryOptions;
    connectionId: string;
  }): Promise<BaseRecord[]> {
    const entity = await this.getEntity({ name: entityName, connectionId });
    if (!entity) {
      return [];
    }

    let records = await this.getRecordsByEntityId({ entityId: entity.id });

    // Apply basic filtering based on options
    if (options.filters) {
      records = records.filter(() => {
        // Implement your filtering logic here
        return true; // Placeholder
      });
    }

    // Apply sorting
    if (options.sort) {
      records = records.sort(() => {
        // Implement your sorting logic here
        return 0; // Placeholder
      });
    }

    // Apply pagination
    if (options.limit) {
      const start = options.offset || 0;
      records = records.slice(start, start + options.limit);
    }

    return records;
  }

  async syncRecords({
    connectionId,
    name,
    records,
    lastSyncId,
  }: {
    name: string;
    connectionId: string;
    records: Pick<BaseRecord, 'externalId' | 'data'>[];
    lastSyncId?: string;
  }): Promise<void> {
    let entity = await this.getEntity({ name, connectionId });
    if (!entity) {
      entity = await this.createEntity({ name, connectionId });
    }

    await this.upsertRecords({
      entityId: entity.id,
      records: records.map(record => ({
        ...record,
        lastSyncId,
        entityType: name, // Using name as entityType for simplicity
      })),
    });
  }
}
