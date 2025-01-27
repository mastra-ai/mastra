import { describe, beforeEach, test, expect } from 'vitest';

import { MockMastraEngine } from './engine.mock';
import { BaseEntity } from './types';

describe('MockMastraEngine', () => {
  let engine: MockMastraEngine;

  beforeEach(() => {
    engine = new MockMastraEngine({ url: 'mock://localhost' });
  });

  describe('Entity Operations', () => {
    const testEntity = {
      name: 'TestEntity',
      connectionId: 'conn123',
    };

    test('should create an entity', async () => {
      const entity = await engine.createEntity(testEntity);

      expect(entity).toMatchObject({
        name: testEntity.name,
        connectionId: testEntity.connectionId,
      });
      expect(entity.id).toBeDefined();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    test('should get entity by ID', async () => {
      const created = await engine.createEntity(testEntity);
      const retrieved = await engine.getEntityById({ id: created.id });

      expect(retrieved).toEqual(created);
    });

    test('should throw error when getting non-existent entity by ID', async () => {
      await expect(engine.getEntityById({ id: 'nonexistent' })).rejects.toThrow('Entity with id nonexistent not found');
    });

    test('should get entity by name and connectionId', async () => {
      const created = await engine.createEntity(testEntity);
      const retrieved = await engine.getEntity({
        name: testEntity.name,
        connectionId: testEntity.connectionId,
      });

      expect(retrieved).toEqual(created);
    });

    test('should delete entity and its records', async () => {
      const entity = await engine.createEntity(testEntity);

      // Add some records
      await engine.upsertRecords({
        entityId: entity.id,
        records: [
          {
            externalId: 'ext1',
            data: { value: 'test' },
            entityType: 'TestEntity',
          },
        ],
      });

      const deletedEntity = await engine.deleteEntityById({ id: entity.id });
      expect(deletedEntity).toEqual(entity);

      // Verify entity is deleted
      await expect(engine.getEntityById({ id: entity.id })).rejects.toThrow();

      // Verify records are deleted
      const records = await engine.getRecordsByEntityId({ entityId: entity.id });
      expect(records).toHaveLength(0);
    });
  });

  describe('Record Operations', () => {
    let testEntity: BaseEntity;
    const testRecords = [
      {
        externalId: 'ext1',
        data: { value: 'test1' },
        entityType: 'TestEntity',
      },
      {
        externalId: 'ext2',
        data: { value: 'test2' },
        entityType: 'TestEntity',
      },
    ];

    beforeEach(async () => {
      testEntity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn123',
      });
    });

    test('should upsert records', async () => {
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: testRecords,
      });

      const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
      expect(records).toHaveLength(2);
      expect(records[0].data).toEqual(testRecords[0].data);
      expect(records[1].data).toEqual(testRecords[1].data);
    });

    test('should update existing records on upsert', async () => {
      // Initial insert
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: [testRecords[0]],
      });

      // Update with new data
      const updatedData = { value: 'updated' };
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: [
          {
            ...testRecords[0],
            data: updatedData,
          },
        ],
      });

      const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
      expect(records).toHaveLength(1);
      expect(records[0].data).toEqual(updatedData);
    });

    test('should get records by entity name', async () => {
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: testRecords,
      });

      const records = await engine.getRecordsByEntityName({
        name: testEntity.name,
        connectionId: testEntity.connectionId,
      });

      expect(records).toHaveLength(2);
      expect(records.map(r => r.externalId)).toEqual(testRecords.map(r => r.externalId));
    });

    test('should return empty array for non-existent entity name', async () => {
      const records = await engine.getRecordsByEntityName({
        name: 'NonExistent',
        connectionId: 'conn123',
      });

      expect(records).toEqual([]);
    });
  });

  describe('Query Operations', () => {
    let testEntity: BaseEntity;

    beforeEach(async () => {
      testEntity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn123',
      });
    });

    test('should get records with pagination', async () => {
      const testRecords = Array.from({ length: 5 }, (_, i) => ({
        externalId: `ext${i}`,
        data: { value: `test${i}` },
        entityType: 'TestEntity',
      }));

      await engine.upsertRecords({
        entityId: testEntity.id,
        records: testRecords,
      });

      const records = await engine.getRecords({
        entityName: testEntity.name,
        connectionId: testEntity.connectionId,
        options: {
          limit: 2,
          offset: 1,
        },
      });

      expect(records).toHaveLength(2);
    });
  });

  describe('Sync Operations', () => {
    let testEntity: BaseEntity;

    beforeEach(async () => {
      testEntity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn123',
      });
    });

    test('should sync data for existing entity', async () => {
      const syncData = [
        {
          externalId: 'ext1',
          data: { value: 'sync1' },
        },
        {
          externalId: 'ext2',
          data: { value: 'sync2' },
        },
      ];

      await engine.syncRecords({
        name: testEntity.name,
        connectionId: testEntity.connectionId,
        records: syncData,
      });

      const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
      expect(records).toHaveLength(2);
      expect(records[0].data).toEqual(syncData[0].data);
      expect(records[1].data).toEqual(syncData[1].data);
    });
  });
});
