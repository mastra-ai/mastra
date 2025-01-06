import { Telemetry } from '../telemetry';

import { BaseEntity, BaseRecord, QueryOptions } from './types';

export interface DatabaseConfig {
  url: string;
  // Add other configuration options as needed
}

export abstract class MastraEngine {
  #telemetry?: Telemetry;

  /**
   * Initializes the database connection
   * @param config Configuration object for database connection
   */
  constructor(_config: DatabaseConfig) {}
  /**
   * Set the telemetry on the engine
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.#telemetry = telemetry;
    console.log(`${this.#telemetry.name} set on engine`);
  }

  /**
   * Get the telemetry on the engine
   * @returns telemetry
   */
  __getTelemetry() {
    return this.#telemetry;
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

  // Add protected method to access telemetry
  protected getTelemetry(): Telemetry | undefined {
    return this.#telemetry;
  }

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
