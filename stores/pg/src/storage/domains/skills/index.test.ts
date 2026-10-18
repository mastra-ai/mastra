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

  it('bumps updatedAt when an update re-sends unchanged snapshot fields', async () => {
    const skills = await store.getStore('skills');
    const id = randomUUID();
    const snapshot = { name: 'my-skill', description: 'desc', instructions: 'do the thing' };
    await skills.create({ skill: { id, ...snapshot } });
    const before = (await skills.getById(id))!;

    await new Promise(resolve => setTimeout(resolve, 20));
    await skills.update({ id, ...snapshot });

    const after = (await skills.getById(id))!;
    expect(await skills.countVersions(id)).toBe(1);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});
