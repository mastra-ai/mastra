import type { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { SlackManifestClient } from './client';
import { buildManifest } from './manifest';
import { SlackProvider, hashConfig } from './provider';

// Manifest built on the base tree (before computer cards) for the fixture below.
const BASE_MANIFEST = {
  display_information: {
    name: 'Helper',
    description: 'Helps',
  },
  features: {
    app_home: {
      home_tab_enabled: false,
      messages_tab_enabled: true,
      messages_tab_read_only_enabled: false,
    },
    bot_user: {
      display_name: 'Helper',
      always_online: true,
    },
    assistant_view: {
      assistant_description: 'Helps',
    },
    slash_commands: [
      {
        command: '/ask',
        description: 'Ask',
        url: 'https://example.com/slack/commands/w1',
      },
    ],
  },
  oauth_config: {
    redirect_urls: ['https://example.com/slack/oauth/callback'],
    scopes: {
      bot: [
        'chat:write',
        'chat:write.public',
        'im:write',
        'channels:history',
        'channels:read',
        'groups:history',
        'groups:read',
        'im:history',
        'im:read',
        'mpim:history',
        'mpim:read',
        'app_mentions:read',
        'users:read',
        'reactions:write',
        'files:read',
        'files:write',
        'assistant:write',
        'commands',
      ],
    },
  },
  settings: {
    event_subscriptions: {
      request_url: 'https://example.com/slack/events/w1',
      bot_events: ['app_mention', 'message.channels', 'message.groups', 'message.im', 'message.mpim'],
    },
    interactivity: {
      is_enabled: true,
      request_url: 'https://example.com/slack/events/w1',
    },
    org_deploy_enabled: false,
    socket_mode_enabled: false,
    token_rotation_enabled: false,
  },
};

const fixture = {
  name: 'Helper',
  description: 'Helps',
  webhookUrl: 'https://example.com/slack/events/w1',
  oauthRedirectUrl: 'https://example.com/slack/oauth/callback',
  commandsUrl: 'https://example.com/slack/commands/w1',
  slashCommands: [{ command: '/ask', description: 'Ask' }],
};

describe('computer card manifest', () => {
  it('flag off: manifest is identical to the base tree', () => {
    expect(buildManifest(fixture)).toEqual(BASE_MANIFEST);
    expect(buildManifest({ ...fixture, computer: false })).toEqual(BASE_MANIFEST);
  });

  it('flag on: adds exactly the Work Object scopes, event, and rich_previews', () => {
    const on = buildManifest({ ...fixture, computer: true }) as any;
    const base = structuredClone(BASE_MANIFEST) as any;
    base.oauth_config.scopes.bot.push('links:read', 'links:write');
    base.settings.event_subscriptions.bot_events.push('entity_details_requested');
    base.features.rich_previews = { is_active: true, entity_types: ['slack#/entities/file'] };
    expect(on).toEqual(base);
    expect(JSON.stringify(on)).not.toContain('link_shared');
  });
});

describe('computer card config hash', () => {
  it('golden: hash with computer omitted or false equals the base-tree value', () => {
    expect(hashConfig({}, 'https://example.com', 'Helper', 'Helps')).toBe('64e81e5a284694fa');
    expect(hashConfig({ computer: false }, 'https://example.com', 'Helper', 'Helps')).toBe('64e81e5a284694fa');
    const cmds = [{ command: '/ask', description: 'Ask' }];
    expect(hashConfig({ slashCommands: cmds }, 'https://example.com', 'Helper', 'Helps')).toBe('3b738ea392647f3b');
  });

  it('flag on changes the hash', () => {
    expect(hashConfig({ computer: true }, 'https://example.com', 'Helper', 'Helps')).not.toBe('64e81e5a284694fa');
  });
});

describe('computer card drift', () => {
  let updateApp: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    updateApp = vi.spyOn(SlackManifestClient.prototype, 'updateApp').mockResolvedValue(undefined as any);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  });

  async function boot(configHash: string) {
    const store = new InMemoryStore();
    const channels = (await store.getStore('channels'))!;
    await channels.saveInstallation({
      id: 'inst-1',
      platform: 'slack',
      agentId: 'agent-1',
      status: 'active',
      webhookId: 'w1',
      configHash,
      data: {
        appId: 'A1',
        clientId: 'cid',
        clientSecret: 'cs',
        signingSecret: 'ss',
        teamId: 'T1',
        botToken: 'xoxb-test',
        botUserId: 'UBOT',
        name: 'Helper',
        description: 'Helps',
      },
    } as any);
    const agent: any = {
      name: 'Helper',
      getDescription: () => 'Helps',
      getChannels: () => undefined,
      setChannels: vi.fn(),
    };
    const provider = new SlackProvider({ baseUrl: 'https://example.com', tokenResolver: async () => 'token' });
    provider.__attach({
      getStorage: () => store,
      getAgentById: () => agent,
      getAgent: () => agent,
      getLogger: () => undefined,
    } as unknown as Mastra);
    await provider.initialize();
    const [record] = await channels.listInstallations('slack');
    return record!;
  }

  it('flag off: a base-hash install triggers no manifest update', async () => {
    await boot('64e81e5a284694fa');
    expect(updateApp).not.toHaveBeenCalled();
  });

  it('flag on: a base-hash install gets exactly one update with rich_previews, then is stable', async () => {
    process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
    const record = await boot('64e81e5a284694fa');
    expect(updateApp).toHaveBeenCalledTimes(1);
    const manifest = updateApp.mock.calls[0]![1] as any;
    expect(manifest.features.rich_previews).toEqual({ is_active: true, entity_types: ['slack#/entities/file'] });
    expect(manifest.settings.event_subscriptions.bot_events).toContain('entity_details_requested');
    expect(record.configHash).toBe(hashConfig({ computer: true }, 'https://example.com', 'Helper', 'Helps'));

    updateApp.mockClear();
    await boot(record.configHash!);
    expect(updateApp).not.toHaveBeenCalled();
  });
});
