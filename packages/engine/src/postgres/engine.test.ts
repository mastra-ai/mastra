import { expect, describe, it, afterAll } from '@jest/globals';
import { BaseConnection, BaseEntity, CredentialInput, PropertyType } from '@mastra/core';

import { PostgresEngine } from './engine.js';

const engine = new PostgresEngine({
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/mastra',
});

let testConnection: BaseConnection;
let testEntity: BaseEntity;

describe('Postgres Engine', () => {
  afterAll(async () => {
    let existingEntity = await engine.getEntityByConnectionAndType({
      kId: testConnection.id,
      type: 'FOO',
    });

    if (existingEntity) {
      await engine.deletePropertiesByEntityId({ id: existingEntity.id });
      await engine.deleteRecordsByEntityId({ id: existingEntity.id });
      await engine.deleteEntityById({ id: existingEntity.id });
    }

    await engine.deletePropertiesByEntityId({ id: testEntity.id });
    await engine.deleteRecordsByEntityId({ id: testEntity.id });
    await engine.deleteEntityById({ id: testEntity.id });
    await engine.deleteConnection({ kId: testConnection.id });
    await engine.close();
  });

  describe('Connection and Credential Management', () => {
    it('should create and retrieve a connection with credentials', async () => {
      // Create a new connection
      const connection = {
        connectionId: 'test-connection-1' + Date.now(),
        name: 'Test Connection',
        issues: ['apple', 'banana'],
        syncConfig: {},
      };

      const credential: CredentialInput = {
        type: 'oauth',
        value: { token: 'test-token' },
        scope: ['read', 'write'],
      };

      // Create connection
      testConnection = await engine.createConnection({
        connection,
        credential,
      });

      console.log('created connection', testConnection);

      // Verify connection was created
      expect(testConnection).toBeDefined();
      expect(testConnection.id).toBeDefined();
      expect(testConnection.connectionId).toBe(connection.connectionId);

      // Retrieve credentials
      const retrievedCredentials = await engine.getCredentialsByConnection(testConnection.id);

      console.log('retrieved credentials', retrievedCredentials);

      expect(retrievedCredentials).toBeDefined();
      expect(retrievedCredentials.type).toBe('oauth');
      expect(retrievedCredentials.value).toEqual({ token: 'test-token' });
      expect(retrievedCredentials.scope).toEqual(['read', 'write']);
    });

    it('getConnection', async () => {
      const connection = await engine.getConnection({
        connectionId: testConnection.connectionId,
        name: testConnection.name,
      });
      expect(connection).toBeDefined();
      expect(connection.id).toBe(testConnection.id);
    });

    it('getConnectionById', async () => {
      const connection = await engine.getConnectionById({ kId: testConnection.id });
      expect(connection).toBeDefined();
      expect(connection?.id).toBe(testConnection.id);
    });

    it('getAllConnections', async () => {
      const connections = await engine.getAllConnections();
      expect(connections).toBeDefined();
      expect(connections.length).toBeGreaterThan(0);
    });

    it('getConnectionsByIntegrationName', async () => {
      const connections = await engine.getConnectionsByIntegrationName({ name: 'Test Connection' });
      expect(connections).toBeDefined();
      expect(connections.length).toBeGreaterThan(0);
    });

    it('setConnectionSubscriptionId', async () => {
      const subscriptionId = 'test-subscription-id';
      const updatedConnection = await engine.setConnectionSubscriptionId({ kId: testConnection.id, subscriptionId });
      expect(updatedConnection).toBeDefined();
      expect(updatedConnection.subscriptionId).toBe(subscriptionId);
    });

    it('getConnectionsBySubscriptionId', async () => {
      const connection = await engine.getConnectionById({ kId: testConnection.id });
      expect(connection?.subscriptionId).toBeDefined();
      if (testConnection.subscriptionId) {
        const connections = await engine.getConnectionsBySubscriptionId({
          subscriptionId: testConnection.subscriptionId,
        });
        expect(connections).toBeDefined();
        expect(connections.length).toBeGreaterThan(0);
      }
    });

    it('should update connection credential token', async () => {
      const newToken = { token: 'updated-token' };

      const updatedCredential = await engine.updateConnectionCredentialToken({
        kId: testConnection.id,
        token: newToken,
      });

      expect(updatedCredential).toBeDefined();
      expect(updatedCredential.value).toEqual(newToken);
    });

    it('should update connection credentials', async () => {
      const newToken = { token: 'updated-token' };

      const updatedCredential = await engine.updateConnectionCredentials({
        kId: testConnection.id,
        ...newToken,
        scope: ['read', 'write', 'delete'],
      });

      console.log(updatedCredential);

      expect(updatedCredential).toBeDefined();
      expect(updatedCredential.scope).toEqual(['read', 'write', 'delete']);
      expect(updatedCredential.value).toEqual(newToken);
    });

    it('setConnectionError', async () => {
      const error = 'test-error';
      const updatedConnection = await engine.setConnectionError({ kId: testConnection.id, error });
      expect(updatedConnection).toBeDefined();
      expect(updatedConnection.issues?.[0]).toBe(error);
    });
  });

  describe('Entity Management', () => {
    it('should create and retrieve an entity', async () => {
      testEntity = await engine.createEntity({
        connectionId: testConnection.connectionId,
        type: 'TEST',
        kId: testConnection.id,
      });

      console.log('created entity', testEntity);
      expect(testEntity).toBeDefined();
    });

    it('getEntity', async () => {
      const entity = await engine.getEntityById({ id: testEntity.id });
      expect(entity).toBeDefined();
      expect(entity.id).toBe(testEntity.id);
    });

    it('updateEntityLastSyncId', async () => {
      const syncId = 'test-last-sync-id';
      const updatedEntity = await engine.updateEntityLastSyncId({ id: testEntity.id, syncId });
      expect(updatedEntity).toBeDefined();
      expect(updatedEntity.lastSyncId).toBe(syncId);
    });

    it('getEntityByConnectionAndType', async () => {
      const entity = await engine.getEntityByConnectionAndType({ kId: testConnection.id, type: 'TEST' });
      expect(entity).toBeDefined();
      expect(entity?.id).toBe(testEntity.id);
    });
  });

  describe('Records', () => {
    it('mergeExternalRecordsForEntity', async () => {
      const records = [
        {
          externalId: 'test-external-id-1',
          data: { name: 'test-record-1' },
          entityType: 'TEST',
        },
        {
          externalId: 'test-external-id-2',
          data: { name: 'test-record-2' },
          entityType: 'TEST',
        },
      ];

      await engine.mergeExternalRecordsForEntity({ entityId: testEntity.id, records });

      const recordsRetrieved = await engine.getEntityRecordsByConnectionAndType({
        kId: testConnection.id,
        type: 'TEST',
      });

      expect(recordsRetrieved?.records[0].externalId).toBe('test-external-id-1');
    });

    it('getEntityRecordsByConnectionAndType', async () => {
      const recordsRetrieved = await engine.getEntityRecordsByConnectionAndType({
        kId: testConnection.id,
        type: 'TEST',
      });
      expect(recordsRetrieved?.records[0].externalId).toBe('test-external-id-1');
    });

    it('addPropertiesToEntity', async () => {
      const properties = [
        {
          name: 'test-property-1',
          displayName: 'Test Property 1',
          visible: true,
          config: {},
          description: 'Test Property 1',
          type: PropertyType.LONG_TEXT,
          order: 1,
          modifiable: true,
        },
        {
          name: 'test-property-2',
          displayName: 'Test Property 2',
          visible: true,
          config: {},
          description: 'Test Property 2',
          type: PropertyType.LONG_TEXT,
          order: 2,
          modifiable: true,
        },
      ];

      await engine.addPropertiesToEntity({ entityId: testEntity.id, properties });

      const recordsRetrieved = await engine.getEntityRecordsByConnectionAndType({
        kId: testConnection.id,
        type: 'TEST',
      });

      expect(recordsRetrieved?.properties[0].name).toBe('test-property-1');
    });

    it('getPropertiesByEntityType', async () => {
      const properties = await engine.getPropertiesByEntityType({ entityType: 'TEST' });
      expect(properties).toBeDefined();
      expect(properties.length).toBeGreaterThan(0);
    });

    it('getRecordsByPropertyName', async () => {
      const records = await engine.getRecordsByPropertyName({
        connectionId: testConnection.connectionId,
        propertyName: 'name',
      });
      expect(records).toBeDefined();
      expect(records?.[0]?.record?.data?.name).toBe('test-record-1');
      expect(records.length).toBeGreaterThan(0);
    });

    it('getRecordByPropertyNameAndValue', async () => {
      const record = await engine.getRecordByPropertyNameAndValue({
        type: 'TEST',
        connectionId: testConnection.connectionId,
        propertyName: 'name',
        propertyValue: 'test-record-1',
      });
      expect(record).toBeDefined();
      expect(record?.data?.name).toBe('test-record-1');
    });

    it('getRecordByPropertyNameAndValues', async () => {
      const records = await engine.getRecordByPropertyNameAndValues({
        connectionId: testConnection.connectionId,
        propertyName: 'name',
        propertyValues: ['test-record-1', 'test-record-2'],
      });
      expect(records).toBeDefined();
      expect(records.length).toBe(2);
    });

    it('syncData', async () => {
      const records = [
        {
          externalId: 'test-external-id-1',
          data: { name: 'test-record-1' },
          entityType: 'FOO',
        },
        {
          externalId: 'test-external-id-2',
          data: { name: 'test-record-2' },
          entityType: 'FOO',
        },
      ];

      const properties = [
        {
          name: 'test-property-1',
          displayName: 'Test Property 1',
          visible: true,
          config: {},
          description: 'Test Property 1',
          type: PropertyType.LONG_TEXT,
          order: 1,
          modifiable: true,
        },
        {
          name: 'test-property-2',
          displayName: 'Test Property 2',
          visible: true,
          config: {},
          description: 'Test Property 2',
          type: PropertyType.LONG_TEXT,
          order: 2,
          modifiable: true,
        },
      ];

      await engine.syncData({
        name: 'Test Connection',
        type: 'FOO',
        connectionId: testConnection.connectionId,
        data: records,
        properties,
      });

      const recordsRetrieved = await engine.getEntityRecordsByConnectionAndType({
        kId: testConnection.id,
        type: 'FOO',
      });

      expect(recordsRetrieved).toBeDefined();
      expect(recordsRetrieved?.records?.length).toBe(2);
    });
  });
});
