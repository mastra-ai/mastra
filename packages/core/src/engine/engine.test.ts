import { MockMastraEngine } from './engine.mock';
import { BaseEntity } from './types';

describe('MastraEngine', () => {
  let engine: MockMastraEngine;

  beforeEach(() => {
    engine = new MockMastraEngine({ url: 'mock://test' });
  });

  describe('Entity Operations', () => {
    it('should create an entity', async () => {
      const entity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn1',
      });

      expect(entity).toMatchObject({
        name: 'TestEntity',
        connectionId: 'conn1',
      });
      expect(entity.id).toBeDefined();
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });

    it('should retrieve an entity by ID', async () => {
      const created = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn1',
      });

      const retrieved = await engine.getEntityById({ id: created.id });
      expect(retrieved).toEqual(created);
    });

    it('should throw error when getting non-existent entity', async () => {
      await expect(engine.getEntityById({ id: 'non-existent' })).rejects.toThrow('Entity not found');
    });

    it('should filter entities by name and connectionId', async () => {
      await engine.createEntity({ name: 'Entity1', connectionId: 'conn1' });
      await engine.createEntity({ name: 'Entity2', connectionId: 'conn1' });
      await engine.createEntity({ name: 'Entity1', connectionId: 'conn2' });

      const filteredByName = await engine.getEntities({ name: 'Entity1' });
      expect(filteredByName).toHaveLength(2);

      const filteredByConn = await engine.getEntities({ connectionId: 'conn1' });
      expect(filteredByConn).toHaveLength(2);

      const filteredBoth = await engine.getEntities({
        name: 'Entity1',
        connectionId: 'conn1',
      });
      expect(filteredBoth).toHaveLength(1);
    });
  });

  describe('Record Operations', () => {
    let testEntity: BaseEntity;

    beforeEach(async () => {
      testEntity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn1',
      });
    });

    it('should upsert new records', async () => {
      const recordData = {
        externalId: 'ext1',
        data: { foo: 'bar' },
        entityType: 'test',
      };

      await engine.upsertRecords({
        entityId: testEntity.id,
        records: [recordData],
      });

      const records = await engine.getRecordsByEntityId({
        entityId: testEntity.id,
      });

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        entityId: testEntity.id,
        ...recordData,
      });
    });

    it('should update existing records', async () => {
      const externalId = 'ext1';

      // Initial insert
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: [
          {
            externalId,
            data: { foo: 'bar' },
            entityType: 'test',
          },
        ],
      });

      // Update
      await engine.upsertRecords({
        entityId: testEntity.id,
        records: [
          {
            externalId,
            data: { foo: 'baz' },
            entityType: 'test',
          },
        ],
      });

      const records = await engine.getRecordsByEntityId({
        entityId: testEntity.id,
      });

      expect(records).toHaveLength(1);
      expect(records[0].data).toEqual({ foo: 'baz' });
    });
  });

  describe('MastraEngine Delete Operations', () => {
    let engine: MockMastraEngine;
    let testEntity: BaseEntity;

    beforeEach(async () => {
      engine = new MockMastraEngine({ url: 'mock://test' });
      testEntity = await engine.createEntity({
        name: 'TestEntity',
        connectionId: 'conn1',
      });
    });

    describe('Entity Deletion', () => {
      it('should delete an entity and its associated records', async () => {
        // Create some records
        await engine.upsertRecords({
          entityId: testEntity.id,
          records: [
            { externalId: 'ext1', data: { foo: 'bar' }, entityType: 'test' },
            { externalId: 'ext2', data: { foo: 'baz' }, entityType: 'test' },
          ],
        });

        // Verify records exist
        let records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
        expect(records).toHaveLength(2);

        // Delete the entity
        await engine.deleteEntity({ id: testEntity.id });

        // Verify entity is deleted
        await expect(engine.getEntityById({ id: testEntity.id })).rejects.toThrow('Entity not found');

        // Verify associated records are deleted
        records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
        expect(records).toHaveLength(0);
      });

      it('should throw error when deleting non-existent entity', async () => {
        await expect(engine.deleteEntity({ id: 'non-existent' })).rejects.toThrow('Entity not found');
      });
    });

    describe('Record Deletion', () => {
      beforeEach(async () => {
        // Create test records
        await engine.upsertRecords({
          entityId: testEntity.id,
          records: [
            { externalId: 'ext1', data: { foo: 'bar' }, entityType: 'test' },
            { externalId: 'ext2', data: { foo: 'baz' }, entityType: 'test' },
            { externalId: 'ext3', data: { foo: 'qux' }, entityType: 'test' },
          ],
        });
      });

      it('should delete records by entityId', async () => {
        await engine.deleteRecords({ entityId: testEntity.id });
        const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
        expect(records).toHaveLength(0);
      });

      it('should delete records by externalIds', async () => {
        await engine.deleteRecords({ externalIds: ['ext1', 'ext2'] });
        const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
        expect(records).toHaveLength(1);
        expect(records[0].externalId).toBe('ext3');
      });

      it('should throw error when no deletion criteria provided', async () => {
        await expect(engine.deleteRecords({})).rejects.toThrow('Either entityId or externalIds must be provided');
      });

      it('should handle deletion of non-existent records gracefully', async () => {
        await engine.deleteRecords({ externalIds: ['non-existent'] });
        const records = await engine.getRecordsByEntityId({ entityId: testEntity.id });
        expect(records).toHaveLength(3); // All original records should remain
      });
    });
  });
});
