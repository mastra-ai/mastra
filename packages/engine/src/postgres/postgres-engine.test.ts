import { expect, describe, it, afterAll } from '@jest/globals';
import { BaseEntity } from '@mastra/core';
import { config } from 'dotenv';

import { PostgresEngine } from './engine.js';

config();

const engine = new PostgresEngine({
  url: process.env.DB_URL!,
});

let testEntity = {} as BaseEntity;

const connectionId = 'TEST'

describe('Postgres Engine', () => {
  afterAll(async () => {
    let existingEntity = await engine.getEntity({
      connectionId,
      name: 'FOO',
    })?.[0];

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

    it('syncData', async () => {
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

      await engine.syncData({
        name: 'FOO',
        connectionId,
        data: records,
      });

      const recordsRetrieved = await engine.getRecordsByEntityName({
        connectionId,
        name: 'FOO',
      });

      expect(recordsRetrieved).toBeDefined();
      expect(recordsRetrieved?.length).toBe(2);
    });
  });
});
