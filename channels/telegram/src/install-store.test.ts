import { describe, expect, it } from 'vitest';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import { PLATFORM, TelegramInstallStore, toInstallationInfo } from './index';
import type { TelegramInstallation } from './index';

function makeStore() {
  return new TelegramInstallStore(new InMemoryChannelsStorage());
}

const active: TelegramInstallation = {
  id: 'inst-1',
  agentId: 'agent-1',
  webhookId: 'wh-1',
  status: 'active',
  botToken: '123:ABC',
  secretToken: 'sekret',
  username: 'my_bot',
  webhookUrl: 'https://x.example.com/telegram/events/wh-1',
  commands: [{ command: 'help', description: 'Run /help' }],
  installedAt: new Date('2026-07-05T00:00:00Z'),
};

describe('TelegramInstallStore', () => {
  it('round-trips an installation by agent and by webhookId', async () => {
    const store = makeStore();
    await store.save(active);

    const byAgent = await store.getByAgent('agent-1');
    expect(byAgent).toMatchObject({
      id: 'inst-1',
      webhookId: 'wh-1',
      status: 'active',
      botToken: '123:ABC',
      secretToken: 'sekret',
      username: 'my_bot',
      commands: [{ command: 'help', description: 'Run /help' }],
    });

    const byWebhook = await store.getByWebhookId('wh-1');
    expect(byWebhook?.id).toBe('inst-1');
  });

  it('returns null for unknown lookups', async () => {
    const store = makeStore();
    expect(await store.getByAgent('nope')).toBeNull();
    expect(await store.getByWebhookId('nope')).toBeNull();
  });

  it('lists and deletes by agent', async () => {
    const store = makeStore();
    await store.save(active);
    await store.save({ ...active, id: 'inst-2', agentId: 'agent-2', webhookId: 'wh-2', status: 'pending' });

    expect(await store.list()).toHaveLength(2);

    await store.deleteByAgent('agent-1');
    const remaining = await store.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].agentId).toBe('agent-2');
  });

  it('projects public info without secrets', () => {
    const info = toInstallationInfo(active);
    expect(info).toEqual({
      id: 'inst-1',
      platform: PLATFORM,
      agentId: 'agent-1',
      status: 'active',
      displayName: 'my_bot',
      installedAt: active.installedAt,
    });
    expect(JSON.stringify(info)).not.toContain('123:ABC');
    expect(JSON.stringify(info)).not.toContain('sekret');
  });
});
