import { BaseEntity, BaseRecord } from './types';

// export * from './schema';
export * from './types';
export * from './utils';

export interface DatabaseConfig {
  url: string;
  // Add other configuration options as needed
}

export abstract class MastraEngine {
  /**
   * Initializes the database connection
   * @param config Configuration object for database connection
   */
  constructor(config: DatabaseConfig) {
    console.log('ci===', config);
  }

  // Entity Management
  abstract createEntity(params: {
    name: string;
    // ID in your system
    connectionId: string;
  }): Promise<BaseEntity>;

  abstract getEntityById(params: { id: string }): Promise<BaseEntity>;

  abstract getEntity({ connectionId, name }: { name?: string; connectionId?: string }): Promise<BaseEntity | undefined>;

  abstract deleteEntityById({ id }: { id: string }): Promise<BaseEntity>

  abstract upsertRecords(params: {
    entityId: string;
    records: Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>[];
  }): Promise<void>;

  abstract getRecordsByEntityId(params: { entityId: string }): Promise<BaseRecord[]>;

  abstract getRecordsByEntityName({
    name,
    connectionId,
  }: {
    name: string;
    connectionId: string;
  }): Promise<BaseRecord[]>;

  abstract syncData({
    connectionId,
    name,
    data,
    lastSyncId,
  }: {
    name: string;
    connectionId: string;
    data: Pick<BaseRecord, 'externalId' | 'data'>[];
    lastSyncId?: string;
  }): Promise<void>;
}
