import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('channel JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ id: `channels-json-${randomUUID()}`, connectionString });
    await store.init();
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('repairs invalid characters while preserving literal escapes in installation and config data', async () => {
    const channels = await store.getStore('channels');
    const platform = `test-${randomUUID()}`;
    const data = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800`, nul: 'a\0b' };
    const expected = { path: 'C:\\path\\�-end', literal: data.literal, nul: 'ab' };

    await channels.saveInstallation({
      id: randomUUID(),
      platform,
      agentId: randomUUID(),
      status: 'active',
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const installation = await channels.getInstallationByAgent(
      platform,
      (await channels.listInstallations(platform))[0]!.agentId,
    );
    expect(installation?.data).toEqual(expected);

    await channels.saveConfig({ platform, data, updatedAt: new Date() });
    expect((await channels.getConfig(platform))?.data).toEqual(expected);
  });
});
