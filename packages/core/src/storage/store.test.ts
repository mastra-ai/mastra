import { describe, it, expect, vi } from 'vitest';

import { MastraStorage } from './index';

// Create a concrete implementation of MastraStore for testing
class TestStorage extends MastraStorage {
  private store: Map<string, Record<string, any>> = new Map();

  private getKey(params: { entityName: string; connectionId: string; externalId: string }) {
    return `${params.entityName}:${params.connectionId}:${params.externalId}`;
  }

  async persistWorkflowSnapshot(params: {
    entityName: string;
    connectionId: string;
    externalId: string;
    data: Record<string, any>;
  }): Promise<void> {
    const key = this.getKey(params);
    this.store.set(key, params.data);
  }

  async loadWorkflowSnapshot(params: {
    entityName: string;
    connectionId: string;
    externalId: string;
  }): Promise<Record<string, any> | null> {
    const key = this.getKey(params);
    return this.store.get(key) || null;
  }
}

describe('MastraStorage', () => {
  it('should persist and load snapshots', async () => {
    const store = new TestStorage();
    const testData = {
      entityName: 'test-entity',
      connectionId: 'test-connection',
      externalId: 'test-id',
      data: { foo: 'bar' },
    };

    // Test persisting data
    await store.persistWorkflowSnapshot(testData);

    // Test loading the persisted data
    const loadedData = await store.loadWorkflowSnapshot({
      entityName: testData.entityName,
      connectionId: testData.connectionId,
      externalId: testData.externalId,
    });

    expect(loadedData).toEqual(testData.data);
  });

  it('should return null when loading non-existent snapshot', async () => {
    const store = new TestStorage();

    const loadedData = await store.loadWorkflowSnapshot({
      entityName: 'non-existent',
      connectionId: 'non-existent',
      externalId: 'non-existent',
    });

    expect(loadedData).toBeNull();
  });
});
