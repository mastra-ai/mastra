import { BaseEntity, FilterOperators } from '@mastra/core';
import { config } from 'dotenv';
import { expect, describe, it, afterAll, beforeAll } from 'vitest';

import { PostgresEngine } from './engine.js';

config();

const engine = new PostgresEngine({
  url: process.env.DB_URL!,
});

let testEntity = {} as BaseEntity;
const connectionId = 'TEST';

describe('Postgres Engine', () => {
  afterAll(async () => {
    let existingEntity = await engine.getEntity({
      connectionId,
      name: 'FOO',
    });

    if (existingEntity) {
      await engine.deleteRecordsByEntityId({ id: existingEntity.id });
      await engine.deleteEntityById({ id: existingEntity.id });
    }

    await engine.deleteRecordsByEntityId({ id: testEntity.id });
    await engine.deleteEntityById({ id: testEntity.id });
    await engine.close();
  });

  describe('Entity Management', () => {
    it('should create and retrieve an entity', async () => {
      testEntity = await engine.createEntity({
        connectionId,
        name: 'TEST',
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
      const entity = await engine.getEntity({ connectionId, name: 'TEST' });
      expect(entity).toBeDefined();
      expect(entity?.id).toBe(testEntity.id);
    });

    // New tests for error cases
    it('should throw error when creating entity with invalid data', async () => {
      await expect(engine.createEntity({ connectionId: '', name: '' })).rejects.toThrow();
    });

    it('should throw error when getting non-existent entity', async () => {
      await expect(engine.getEntityById({ id: 'non-existent-id' })).rejects.toThrow(
        'No entity found with id: non-existent-id',
      );
    });
  });

  describe('Records', () => {
    it('upsertRecords', async () => {
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

      await engine.upsertRecords({ entityId: testEntity.id, records });

      const recordsRetrieved = await engine.getRecordsByEntityName({
        connectionId,
        name: 'TEST',
      });

      expect(recordsRetrieved?.[0]?.externalId).toBe('test-external-id-1');
    });

    it('getRecordsByEntityName', async () => {
      const recordsRetrieved = await engine.getRecordsByEntityName({
        connectionId,
        name: 'TEST',
      });
      expect(recordsRetrieved?.[0]?.externalId).toBe('test-external-id-1');
    });

    it('syncRecords', async () => {
      const records = [
        {
          externalId: 'test-external-id-1',
          data: { name: 'test-record-1' },
        },
        {
          externalId: 'test-external-id-2',
          data: { name: 'test-record-2' },
        },
      ];

      await engine.syncRecords({
        name: 'FOO',
        connectionId,
        records,
      });

      const recordsRetrieved = await engine.getRecordsByEntityName({
        connectionId,
        name: 'FOO',
      });

      expect(recordsRetrieved).toBeDefined();
      expect(recordsRetrieved?.length).toBe(2);
    });

    // New tests for record operations
    it('should handle empty records array in upsertRecords', async () => {
      await expect(engine.upsertRecords({ entityId: testEntity.id, records: [] })).resolves.not.toThrow();
    });

    it('should update existing records with new data', async () => {
      const initialRecord = {
        externalId: 'update-test',
        data: { name: 'initial' },
        entityType: 'TEST',
      };

      await engine.upsertRecords({ entityId: testEntity.id, records: [initialRecord] });

      const updatedRecord = {
        externalId: 'update-test',
        data: { name: 'updated', newField: 'value' },
        entityType: 'TEST',
      };

      await engine.upsertRecords({ entityId: testEntity.id, records: [updatedRecord] });

      const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
      const retrievedRecord = records.find(r => r.externalId === 'update-test');

      expect(retrievedRecord?.data).toEqual(updatedRecord.data);
    });

    it('should throw error when getting records for non-existent entity', async () => {
      await expect(engine.getRecordsByEntityId({ entityId: 'non-existent-id' })).resolves.toEqual([]);
    });
  });

  describe('Query Operations', () => {
    // Setup test data for queries
    beforeAll(async () => {
      const records = [
        {
          externalId: 'query-test-1',
          data: {
            name: 'Product 1',
            price: 100,
            category: 'A',
            details: { color: 'red' },
          },
          entityType: 'TEST',
        },
        {
          externalId: 'query-test-2',
          data: {
            name: 'Product 2',
            price: 200,
            category: 'B',
            details: { color: 'blue' },
          },
          entityType: 'TEST',
        },
      ];

      await engine.upsertRecords({ entityId: testEntity.id, records });
    });

    it('should filter records by simple field', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          filters: [{ field: 'name', operator: FilterOperators.EQUAL, value: 'Product 1' }],
        },
      });

      expect(records).toHaveLength(1);
      expect(records?.[0]?.data?.name).toBe('Product 1');
    });

    it('should filter records by nested field', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          filters: [{ field: 'details.color', operator: FilterOperators.EQUAL, value: 'blue' }],
        },
      });

      expect(records).toHaveLength(1);
      expect(records?.[0]?.data?.details?.color).toBe('blue');
    });

    it('should filter records by numeric comparison', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          filters: [{ field: 'price', operator: FilterOperators.GREATER_THAN, value: 150 }],
        },
      });

      expect(records).toHaveLength(1);
      expect(records?.[0]?.data?.price).toBe(200);
    });

    it('should sort records', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          sort: [{ field: 'price', direction: 'ASC' }],
        },
      });

      expect(records?.[0]?.data?.price).toBe(100);
      expect(records?.[1]?.data?.price).toBe(200);
    });

    it('should paginate records', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          limit: 1,
          offset: 1,
        },
      });

      expect(records).toHaveLength(1);
    });

    it('should combine filter, sort, and pagination', async () => {
      const records = await engine.getRecords({
        entityName: 'TEST',
        connectionId,
        options: {
          filters: [{ field: 'price', operator: FilterOperators.GREATER_THAN_OR_EQUAL, value: 100 }],
          sort: [{ field: 'price', direction: 'DESC' }],
          limit: 1,
        },
      });

      expect(records).toHaveLength(1);
      expect(records?.[0]?.data?.price).toBe(200);
    });
  });
});
