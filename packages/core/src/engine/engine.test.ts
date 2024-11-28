import { describe, it, expect, beforeEach } from '@jest/globals';
import { MockEngine } from './engine.mock';
import { PropertyType } from './types';

describe('MastraEngine', () => {
  let engine: MockEngine;
  const mockConfig = { url: 'postgresql://localhost:5432/test' };

  beforeEach(() => {
    engine = new MockEngine(mockConfig);
  });

  describe('Connection Management', () => {
    it('should get connection by ID and name', async () => {
      const connection = await engine.getConnection({
        name: 'test-connection',
        connectionId: 'test-id'
      });

      expect(connection).toMatchObject({
        name: 'test-connection',
        connectionId: 'test-id',
      });
    });

    it('should get all connections', async () => {
      const connections = await engine.getAllConnections();

      expect(connections).toHaveLength(1);
      expect(connections[0]).toMatchObject({
        name: 'mock-connection',
        connectionId: 'mock-id'
      });
    });

    it('should create connection with credentials', async () => {
      const result = await engine.createConnection({
        connection: {
          name: 'new-connection',
          connectionId: 'new-id',
          issues: [],
          syncConfig: {}
        },
        credential: {
          type: 'oauth2',
          value: { token: 'test-token' },
          scope: ['read']
        }
      });

      expect(result).toMatchObject({
        name: 'new-connection',
        credential: {
          type: 'oauth2',
          value: { token: 'test-token' },
          scope: ['read']
        }
      });
    });

    it('should set connection error', async () => {
      const connection = await engine.setConnectionError({
        kId: 'test-id',
        error: 'Test error message'
      });

      expect(connection.issues).toContain('Test error message');
    });
  });

  describe('Credential Management', () => {
    it('should get credentials by connection', async () => {
      const credentials = await engine.getCredentialsByConnection('test-id');

      expect(credentials).toMatchObject({
        type: 'mock',
        connection: {
          id: 'test-id',
          name: 'mock-connection'
        }
      });
    });

    it('should update connection credential token', async () => {
      const newToken = { access_token: 'new-token' };
      const result = await engine.updateConnectionCredentialToken({
        kId: 'test-id',
        token: newToken
      });

      expect(result).toMatchObject({
        value: newToken,
        kId: 'test-id'
      });
    });
  });

  describe('Entity Management', () => {
    it('should create and retrieve entity', async () => {
      const entity = await engine.createEntity({
        kId: 'test-kid',
        type: 'test-type',
        connectionId: 'test-connection'
      });

      expect(entity).toMatchObject({
        id: '1',
        kId: 'test-kid',
        type: 'test-type'
      });
    });

    it('should get entity with records and properties', async () => {
      const result = await engine.getEntityRecordsByConnectionAndType({
        kId: 'test-kid',
        type: 'test-type'
      });

      expect(result).toMatchObject({
        type: 'test-type',
        kId: 'test-kid',
        properties: [],
        records: [expect.objectContaining({
          data: { mock: 'data' }
        })]
      });
    });
  });

  describe('Property Management', () => {
    it('should get properties by entity type', async () => {
      const properties = await engine.getPropertiesByEntityType({
        entityType: 'test-type'
      });

      expect(properties).toHaveLength(1);
      expect(properties[0]).toMatchObject({
        type: PropertyType.SINGLE_LINE_TEXT,
        name: 'mock',
        modifiable: true
      });
    });
  });

  describe('Record Management', () => {
    it('should get filtered records', async () => {
      const records = await engine.getFilteredRecords({
        entityType: 'test-type',
        kId: 'test-kid',
        filters: { field: { eq: 'value' } },
        sort: ['field ASC']
      });

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        id: '1',
        data: { mock: 'data' }
      });
    });

    it('should get records by property name and value', async () => {
      const record = await engine.getRecordByPropertyNameAndValue({
        propertyName: 'test-prop',
        propertyValue: 'test-value',
        type: 'test-type',
        connectionId: 'test-connection'
      });

      expect(record).toMatchObject({
        entityType: 'test-type',
        data: {}
      });
    });
  });
});