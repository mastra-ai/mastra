import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';
import { AgentAvatarsPG } from './index';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('AgentAvatarsPG', () => {
  let store: PostgresStore;
  let avatars: AgentAvatarsPG;

  beforeAll(async () => {
    store = new PostgresStore(TEST_CONFIG);
    await store.init();
    avatars = new AgentAvatarsPG({ client: store.db });
    await avatars.init();
  });

  afterAll(async () => {
    try {
      await store.close();
    } catch {}
  });

  beforeEach(async () => {
    await avatars.dangerouslyClearAll();
  });

  it('is registered on PostgresStore as the agentAvatars domain', async () => {
    const domain = await store.getStore('agentAvatars');
    expect(domain).toBeInstanceOf(AgentAvatarsPG);
  });

  it('returns null for a missing avatar', async () => {
    expect(await avatars.get('missing-agent')).toBeNull();
  });

  it('round-trips avatar bytes as base64', async () => {
    const data = PNG_HEADER.toString('base64');
    await avatars.put({ agentId: 'agent-1', data, mime: 'image/png' });

    const row = await avatars.get('agent-1');
    expect(row).not.toBeNull();
    expect(row!.agentId).toBe('agent-1');
    expect(row!.mime).toBe('image/png');
    expect(row!.sizeBytes).toBe(PNG_HEADER.byteLength);
    expect(Buffer.from(row!.data, 'base64').equals(PNG_HEADER)).toBe(true);
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it('upserts on repeated put and preserves createdAt', async () => {
    await avatars.put({ agentId: 'agent-1', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    const first = await avatars.get('agent-1');

    await new Promise(resolve => setTimeout(resolve, 10));

    const gif = Buffer.from('GIF89a').toString('base64');
    await avatars.put({ agentId: 'agent-1', data: gif, mime: 'image/gif' });

    const second = await avatars.get('agent-1');
    expect(second!.mime).toBe('image/gif');
    expect(Buffer.from(second!.data, 'base64').toString()).toBe('GIF89a');
    expect(second!.createdAt.getTime()).toBe(first!.createdAt.getTime());
    expect(second!.updatedAt.getTime()).toBeGreaterThanOrEqual(first!.updatedAt.getTime());
  });

  it('deletes an avatar and is idempotent', async () => {
    await avatars.put({ agentId: 'agent-1', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await avatars.delete('agent-1');
    expect(await avatars.get('agent-1')).toBeNull();
    await expect(avatars.delete('agent-1')).resolves.toBeUndefined();
  });

  it('dangerouslyClearAll removes every row', async () => {
    await avatars.put({ agentId: 'agent-1', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await avatars.put({ agentId: 'agent-2', data: PNG_HEADER.toString('base64'), mime: 'image/png' });
    await avatars.dangerouslyClearAll();
    expect(await avatars.get('agent-1')).toBeNull();
    expect(await avatars.get('agent-2')).toBeNull();
  });
});
