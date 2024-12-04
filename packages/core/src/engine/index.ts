import { Telemetry } from '../telemetry';

import {
  BaseConnection,
  BaseCredential,
  BaseEntity,
  BaseProperty,
  BaseRecord,
  CredentialInput,
  CredentialUpdateInput,
  CredentialWithConnection,
  FilterObject,
} from './types';

export * from './schema';
export * from './types';
export * from './utils';

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
  constructor(config: DatabaseConfig) {
    console.log('ci===', config);
  }

  /**
   * Set the telemetry for the agent
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.#telemetry = telemetry;
    console.log(`Telemetry updated for Engine ${this.#telemetry.name}`);
  }

  /**
   * Closes the database connection
   */
  abstract close(): Promise<void>;

  // Connection Management
  abstract getConnection(params: {
    name: string;
    connectionId: string;
  }): Promise<BaseConnection>;
  abstract getConnectionById(params: {
    kId: string;
  }): Promise<BaseConnection | undefined>;
  abstract getAllConnections(): Promise<
    Pick<BaseConnection, 'name' | 'connectionId'>[]
  >;
  abstract getConnectionsByIntegrationName(params: {
    name: string;
  }): Promise<BaseConnection[]>;
  abstract getConnectionsBySubscriptionId(params: {
    subscriptionId: string;
  }): Promise<BaseConnection[]>;
  abstract setConnectionSubscriptionId(params: {
    kId: string;
    subscriptionId: string;
  }): Promise<BaseConnection>;
  abstract createConnection(params: {
    connection: Omit<
      BaseConnection,
      'createdAt' | 'updatedAt' | 'id' | 'lastSyncAt'
    >;
    credential: CredentialInput;
  }): Promise<BaseConnection & { credential: BaseCredential }>;
  abstract setConnectionError(params: {
    kId: string;
    error: string;
  }): Promise<BaseConnection>;
  abstract deleteConnection(params: {
    kId: string;
  }): Promise<BaseConnection | null>;

  // Credential Management
  abstract getCredentialsByConnection(
    kId: string
  ): Promise<CredentialWithConnection>;
  abstract updateConnectionCredentialToken(params: {
    kId: string;
    token: Record<string, any>;
  }): Promise<BaseCredential>;
  abstract updateConnectionCredentials(
    params: CredentialUpdateInput & { kId: string }
  ): Promise<BaseCredential>;

  // Entity Management
  abstract createEntity(params: {
    kId: string;
    type: string;
    connectionId: string;
  }): Promise<BaseEntity>;
  abstract getEntityById(params: { id: string }): Promise<BaseEntity>;
  abstract getEntityByConnectionAndType(params: {
    kId: string;
    type: string;
  }): Promise<BaseEntity | null>;
  abstract getEntityRecordsByConnectionAndType(params: {
    kId: string;
    type: string;
  }): Promise<
    (BaseEntity & { properties: BaseProperty[]; records: BaseRecord[] }) | null
  >;
  abstract updateEntityLastSyncId(params: {
    id: string;
    syncId: string;
  }): Promise<BaseEntity>;
  abstract deleteEntityById(params: { id: string }): Promise<BaseEntity>;

  // Record Management
  abstract mergeExternalRecordsForEntity(params: {
    entityId: string;
    records: Pick<BaseRecord, 'externalId' | 'data' | 'entityType'>[];
  }): Promise<void>;
  abstract getRecordsByPropertyName(params: {
    propertyName: string;
    connectionId: string;
  }): Promise<{ record: BaseRecord }[]>;
  abstract getRecordByPropertyNameAndValue(params: {
    propertyName: string;
    propertyValue: string;
    type: string;
    connectionId: string;
  }): Promise<BaseRecord | null>;
  abstract getRecordByPropertyNameAndValues(params: {
    propertyName: string;
    propertyValues: string[];
    type?: string;
    connectionId: string;
  }): Promise<{ record: BaseRecord }[]>;
  abstract deleteRecordsByEntityId(params: {
    id: string;
  }): Promise<BaseRecord[]>;

  // Property Management
  abstract addPropertiesToEntity(params: {
    entityId: string;
    properties: BaseProperty[];
  }): Promise<BaseEntity>;
  abstract getPropertiesByEntityType(params: {
    entityType: string;
  }): Promise<BaseProperty[]>;
  abstract deletePropertiesByEntityId(params: {
    id: string;
  }): Promise<BaseProperty[]>;

  // Data Synchronization
  abstract syncData(params: {
    connectionId: string;
    name: string;
    data: any;
    type: string;
    properties: BaseProperty[];
    lastSyncId?: string;
  }): Promise<void>;

  // Query Building and Filtering
  abstract buildRecordQuerySql(params: {
    whereClause: string;
    filterClause?: string;
    entityType: string;
    sortClauses: string[];
  }): string;

  abstract getFilteredRecords<T extends string | number | symbol>(params: {
    entityType: string;
    filters?: FilterObject<T>;
    sort?: string[];
    kId: string;
  }): Promise<any[]>;

  abstract getRecords<T extends string | number | symbol>(params: {
    entityType: string;
    kId: string;
    filters?: FilterObject<T>;
    sort?: string[];
  }): Promise<any[]>;
}
