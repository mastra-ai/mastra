import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe('skill version JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    await store?.close();
  });

  it('repairs version metadata while preserving literal escape text', async () => {
    const skills = await store.getStore('skills');
    const id = randomUUID();
    const literal = String.raw`literal\uD800`;
    await skills.create({
      skill: {
        id,
        name: 'test',
        description: 'test',
        instructions: 'test',
        metadata: { path: 'C:\\path\\\uD800-end', literal, nul: 'a\0b' },
      },
    });

    expect((await skills.getLatestVersion(id))?.metadata).toEqual({
      path: 'C:\\path\\�-end',
      literal,
      nul: 'ab',
    });
  });
});
