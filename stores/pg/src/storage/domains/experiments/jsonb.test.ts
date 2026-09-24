import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe('experiment JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
  });

  it('repairs result JSONB values without losing literal Unicode escape text', async () => {
    const experiments = await store.getStore('experiments');
    const experiment = await experiments.createExperiment({ id: randomUUID(), totalItems: 1 });
    const literal = String.raw`literal\uD800`;
    const input = { path: 'C:\\path\\\uD800-end', literal, nul: 'a\0b' };
    const result = await experiments.addExperimentResult({
      experimentId: experiment.id,
      itemId: randomUUID(),
      input,
      metadata: input,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
    });

    expect(result.input).toEqual({ path: 'C:\\path\\�-end', literal, nul: 'ab' });
    expect(result.metadata).toEqual(result.input);

    const upserted = await experiments.upsertExperimentResult({
      experimentId: experiment.id,
      itemId: result.itemId,
      input,
      metadata: input,
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
    });
    expect(upserted.id).toBe(result.id);
    expect(upserted.input).toEqual(result.input);
  });
});
