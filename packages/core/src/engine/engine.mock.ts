import { MastraEngine, DatabaseConfig, BaseEntity, BaseRecord } from './';

export class MockMastraEngine extends MastraEngine {
  private entities: BaseEntity[] = [];
  private records: BaseRecord[] = [];

  constructor(config: DatabaseConfig) {
    super(config);
  }

  async createEntity(params: { name: string; connectionId: string }): Promise<BaseEntity> {
    const newEntity: BaseEntity = {
      id: `entity_${Date.now()}`,
      name: params.name,
      connectionId: params.connectionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.entities.push(newEntity);
    return newEntity;
  }

  async deleteEntity(params: { id: string }): Promise<void> {
    const entityIndex = this.entities.findIndex(e => e.id === params.id);
    if (entityIndex === -1) {
      throw new Error(`Entity not found with id: ${params.id}`);
    }

    // Delete all associated records first
    this.records = this.records.filter(record => record.entityId !== params.id);

    // Delete the entity
    this.entities.splice(entityIndex, 1);
  }

  async getEntityById(params: { id: string }): Promise<BaseEntity> {
    const entity = this.entities.find(e => e.id === params.id);
    if (!entity) {
      throw new Error(`Entity not found with id: ${params.id}`);
    }
    return entity;
  }

  async getEntities({ connectionId, name }: { name?: string; connectionId?: string }): Promise<BaseEntity[]> {
    return this.entities.filter(entity => {
      if (connectionId && entity.connectionId !== connectionId) return false;
      if (name && entity.name !== name) return false;
      return true;
    });
  }

  async upsertRecords(params: {
    entityId: string;
    records: Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>[];
  }): Promise<void> {
    const entity = await this.getEntityById({ id: params.entityId });

    for (const record of params.records) {
      const existingRecordIndex = this.records.findIndex(
        r => r.entityId === params.entityId && r.externalId === record.externalId,
      );

      const fullRecord: BaseRecord = {
        id: `record_${Date.now()}`,
        entityId: params.entityId,
        externalId: record.externalId,
        data: record.data,
        entityType: record.entityType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingRecordIndex !== -1) {
        this.records[existingRecordIndex] = {
          ...this.records[existingRecordIndex],
          ...fullRecord,
          updatedAt: new Date(),
        };
      } else {
        this.records.push(fullRecord);
      }
    }
  }

  async deleteRecords(params: { entityId?: string; externalIds?: string[] }): Promise<void> {
    if (!params.entityId && !params.externalIds) {
      throw new Error('Either entityId or externalIds must be provided');
    }

    this.records = this.records.filter(record => {
      // If entityId is provided, filter out records matching that entityId
      if (params.entityId && record.entityId === params.entityId) {
        return false;
      }

      // If externalIds is provided, filter out records matching any of those externalIds
      if (params.externalIds && params.externalIds.includes(record.externalId)) {
        return false;
      }

      return true;
    });
  }

  async getRecordsByEntityId(params: { entityId: string }): Promise<BaseRecord[]> {
    return this.records.filter(record => record.entityId === params.entityId);
  }

  async getRecords(params: { entityName?: string; connectionId?: string }): Promise<BaseRecord[]> {
    let filteredRecords = [...this.records];

    if (params.entityName || params.connectionId) {
      const matchingEntities = await this.getEntities({
        name: params.entityName,
        connectionId: params.connectionId,
      });

      const entityIds = new Set(matchingEntities.map(e => e.id));
      filteredRecords = filteredRecords.filter(record => entityIds.has(record.entityId));
    }

    return filteredRecords;
  }
}
