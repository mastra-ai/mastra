import {
  BaseConnection,
  BaseCredential,
  BaseEntity,
  BaseProperty,
  BaseRecord,
  CredentialUpdateInput,
  CredentialWithConnection,
  FilterObject,
  MastraEngine,
  PropertyType,
} from '.';

export class MockEngine extends MastraEngine {
  constructor(config: { url: string }) {
    super(config);
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }

  // Connection Management
  async getConnection({
    connectionId,
    name,
  }: {
    name: string;
    connectionId: string;
  }): Promise<BaseConnection> {
    return {
      id: '1',
      name,
      connectionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
      syncConfig: {},
      lastSyncAt: new Date(),
    };
  }

  async getConnectionById({
    kId,
  }: {
    kId: string;
  }): Promise<BaseConnection | undefined> {
    return {
      id: kId,
      name: 'mock-connection',
      connectionId: 'mock-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
      syncConfig: {},
      lastSyncAt: new Date(),
    };
  }

  async getAllConnections(): Promise<
    Pick<BaseConnection, 'name' | 'connectionId'>[]
  > {
    return [{ name: 'mock-connection', connectionId: 'mock-id' }];
  }

  async getConnectionsByIntegrationName({
    name,
  }: {
    name: string;
  }): Promise<BaseConnection[]> {
    return [
      {
        id: '1',
        name,
        connectionId: 'mock-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        issues: [],
        syncConfig: {},
        lastSyncAt: new Date(),
      },
    ];
  }

  async getConnectionsBySubscriptionId({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<BaseConnection[]> {
    return [
      {
        id: '1',
        name: 'mock-connection',
        connectionId: 'mock-id',
        subscriptionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        issues: [],
        syncConfig: {},
        lastSyncAt: new Date(),
      },
    ];
  }

  async setConnectionSubscriptionId({
    kId,
    subscriptionId,
  }: {
    kId: string;
    subscriptionId: string;
  }): Promise<BaseConnection> {
    return {
      id: kId,
      name: 'mock-connection',
      connectionId: 'mock-id',
      subscriptionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
      syncConfig: {},
      lastSyncAt: new Date(),
    };
  }

  async createConnection({
    connection,
    credential,
  }: {
    connection: any;
    credential: any;
  }): Promise<BaseConnection & { credential: BaseCredential }> {
    return {
      ...connection,
      id: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      credential: {
        id: '1',
        ...credential,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  async setConnectionError({
    kId,
    error,
  }: {
    kId: string;
    error: string;
  }): Promise<BaseConnection> {
    return {
      id: kId,
      name: 'mock-connection',
      connectionId: 'mock-id',
      issues: [error],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date(),
      syncConfig: {},
    };
  }

  async deleteConnection({
    kId,
  }: {
    kId: string;
  }): Promise<BaseConnection | null> {
    return {
      id: kId,
      name: 'mock-connection',
      connectionId: 'mock-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      issues: [],
      syncConfig: {},
      lastSyncAt: new Date(),
    };
  }

  async getCredentialsByConnection(
    kId: string
  ): Promise<CredentialWithConnection> {
    return {
      id: '1',
      type: 'mock',
      value: {},
      scope: [],
      kId,
      connection: {
        id: kId,
        name: 'mock-connection',
        connectionId: 'mock-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        issues: [],
        syncConfig: {},
        lastSyncAt: new Date(),
      },
    };
  }

  async updateConnectionCredentialToken({
    kId,
    token,
  }: {
    kId: string;
    token: Record<string, any>;
  }): Promise<BaseCredential> {
    return {
      id: '1',
      type: 'mock',
      value: token,
      scope: [],
      kId,
    };
  }

  async updateConnectionCredentials(
    params: CredentialUpdateInput & { kId: string }
  ): Promise<BaseCredential> {
    return {
      id: '1',
      type: params.type || 'mock',
      value: params.value || {},
      scope: params.scope || [],
      kId: params.kId,
    };
  }

  async syncData(params: {
    connectionId: string;
    name: string;
    data: any;
    type: string;
    properties: BaseProperty[];
    lastSyncId?: string;
  }): Promise<void> {
    console.log('syncData', params);
    return Promise.resolve();
  }

  buildRecordQuerySql(params: {
    whereClause: string;
    filterClause?: string;
    entityType: string;
    sortClauses: string[];
  }): string {
    console.log('buildRecordQuerySql', params);
    return 'SELECT * FROM mock_table';
  }

  async getFilteredRecords<T extends string | number | symbol>(params: {
    entityType: string;
    filters?: FilterObject<T>;
    sort?: string[];
    kId: string;
  }): Promise<any[]> {
    return [{ id: '1', data: { mock: 'data' }, params }];
  }

  async getRecords<T extends string | number | symbol>(params: {
    entityType: string;
    kId: string;
    filters?: FilterObject<T>;
    sort?: string[];
  }): Promise<any[]> {
    return [{ id: '1', data: { mock: 'data' }, params }];
  }

  async createEntity(params: any): Promise<any> {
    return { id: '1', ...params };
  }

  async getEntityById(params: { id: string }): Promise<BaseEntity> {
    return {
      id: params.id,
      type: 'mock',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncId: '1',
      createdBy: '1',
      kId: '1',
    };
  }

  async getEntityByConnectionAndType(params: {
    kId: string;
    type: string;
  }): Promise<BaseEntity | null> {
    return {
      id: '1',
      type: params.type,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncId: '1',
      createdBy: '1',
      kId: '1',
    };
  }

  async getEntityRecordsByConnectionAndType(params: {
    kId: string;
    type: string;
  }): Promise<
    (BaseEntity & { properties: BaseProperty[]; records: BaseRecord[] }) | null
  > {
    return {
      id: '1',
      type: params.type,
      kId: params.kId,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncId: '1',
      createdBy: '1',
      properties: [],
      records: [
        {
          id: '1',
          entityId: '1',
          data: { mock: 'data' },
          createdAt: new Date(),
          updatedAt: new Date(),
          externalId: '1',
          entityType: 'mock',
        },
      ],
    };
  }

  async getEntitiesByConnection(connectionId: string): Promise<any[]> {
    return [{ id: '1', connectionId }];
  }

  async getEntities(): Promise<any[]> {
    return [{ id: '1' }];
  }

  async deleteEntity(id: string): Promise<any> {
    return { id };
  }

  async createEntityRecord(params: any): Promise<any> {
    return { id: '1', ...params };
  }

  async getEntityRecordById(id: string): Promise<any> {
    return { id };
  }

  async deleteEntityRecord(id: string): Promise<any> {
    return { id };
  }

  async getEntityRecords(entityId: string): Promise<any[]> {
    return [{ id: '1', entityId }];
  }

  async updateEntityRecord(params: any): Promise<any> {
    return { id: '1', ...params };
  }

  async getEntityProperties(entityId: string): Promise<any[]> {
    return [{ id: '1', entityId }];
  }

  async updateEntityLastSyncId(params: {
    id: string;
    syncId: string;
  }): Promise<BaseEntity> {
    return {
      ...(await this.getEntityById({ id: params.id })),
      lastSyncId: params.syncId,
    };
  }

  async deleteEntityById(params: { id: string }): Promise<BaseEntity> {
    return this.getEntityById({ id: params.id });
  }

  async mergeExternalRecordsForEntity(params: {
    entityId: string;
    records: BaseRecord[];
  }): Promise<void> {
    console.log('mergeExternalRecordsForEntity', params);
    return Promise.resolve();
  }

  async getRecordsByPropertyName(params: {
    propertyName: string;
    connectionId: string;
  }): Promise<{ record: BaseRecord }[]> {
    return [
      {
        record: {
          id: '1',
          entityId: '1',
          data: {
            [params.propertyName]: 'mock',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          externalId: '1',
          entityType: 'mock',
        },
      },
    ];
  }

  async getRecordByPropertyNameAndValue(params: {
    propertyName: string;
    propertyValue: string;
    type: string;
    connectionId: string;
  }): Promise<BaseRecord | null> {
    return {
      id: '1',
      entityId: '1',
      data: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      externalId: '1',
      entityType: params.type,
    };
  }

  async getRecordByPropertyNameAndValues(params: {
    propertyName: string;
    propertyValues: string[];
    type?: string;
    connectionId: string;
  }): Promise<{ record: BaseRecord }[]> {
    return [
      {
        record: (await this.getRecordByPropertyNameAndValue({
          propertyName: params.propertyName,
          propertyValue: params.propertyValues[0] || '',
          type: params.type || 'mock',
          connectionId: params.connectionId,
        })) as BaseRecord,
      },
    ];
  }

  async deleteRecordsByEntityId(params: { id: string }): Promise<BaseRecord[]> {
    return [
      {
        id: '1',
        entityId: params.id,
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        externalId: '1',
        entityType: 'mock',
      },
    ];
  }

  async addPropertiesToEntity(params: {
    entityId: string;
    properties: BaseProperty[];
  }): Promise<BaseEntity> {
    return {
      ...(await this.getEntityById({ id: params.entityId })),
    };
  }

  async getPropertiesByEntityType(params: {
    entityType: string;
  }): Promise<BaseProperty[]> {
    return [
      {
        id: '1',
        name: 'mock',
        type: PropertyType.SINGLE_LINE_TEXT,
        config: {
          required: true,
        },
        description: `property of ${params.entityType}`,
        displayName: 'mock',
        modifiable: true,
        order: 1,
        visible: true,
      },
    ];
  }

  async deletePropertiesByEntityId(params: {
    id: string;
  }): Promise<BaseProperty[]> {
    return [
      {
        id: params.id,
        name: 'mock',
        type: PropertyType.SINGLE_LINE_TEXT,
        config: {
          required: true,
        },
        description: `property`,
        displayName: 'mock',
        modifiable: true,
        order: 1,
        visible: true,
      },
    ];
  }
}
