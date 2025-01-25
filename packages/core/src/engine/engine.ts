import { MastraBase } from '../base.js';

import { BaseEntity, BaseRecord, QueryOptions } from './types';

export interface DatabaseConfig {
  url: string;
  // Add other configuration options as needed
}

export abstract class MastraEngine extends MastraBase {
  /**
   * Initializes the database connection
   * @param config Configuration object for database connection
   */
  constructor(_config: DatabaseConfig) {
    super({ component: 'ENGINE', name: 'MastraEngine' });
  }

  // Entity Management
  abstract createEntity(params: {
    name: string;
    // ID in your system
    connectionId: string;
  }): Promise<BaseEntity>;

  abstract getEntityById(params: { id: string }): Promise<BaseEntity>;

  abstract getEntity({ connectionId, name }: { name?: string; connectionId?: string }): Promise<BaseEntity | undefined>;

  abstract deleteEntityById({ id }: { id: string }): Promise<BaseEntity>;

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

  abstract getRecords({
    entityName,
    connectionId,
    options,
  }: {
    entityName: string;
    options: QueryOptions;
    connectionId: string;
  }): Promise<BaseRecord[]>;

  abstract syncRecords({
    connectionId,
    name,
    records,
    lastSyncId,
  }: {
    name: string;
    connectionId: string;
    records: Pick<BaseRecord, 'externalId' | 'data'>[];
    lastSyncId?: string;
  }): Promise<void>;

  abstract getRecordsByEntityNameAndExternalId({
    entityName,
    connectionId,
    externalId,
  }: {
    entityName: string;
    connectionId: string;
    externalId: string;
  }): Promise<BaseRecord[]>;
}
