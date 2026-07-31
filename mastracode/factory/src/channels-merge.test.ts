import { describe, expect, it } from 'vitest';

import { CHANNEL_CONFIG_KEYS, mergeChannelsConfigs } from './channels-merge.js';
import type { FactoryChannelAdapterEntry, FactoryChannelsConfig } from './integrations/base.js';

function adapter(name: string): FactoryChannelAdapterEntry {
  return { adapter: { name } as never };
}

function contribution(
  integrationClassName: string,
  config: Partial<FactoryChannelsConfig> & Pick<FactoryChannelsConfig, 'adapters'>,
) {
  return { integrationClassName, config };
}

describe('mergeChannelsConfigs', () => {
  it('merges distinct adapter keys in contribution order', () => {
    const slack = adapter('slack');
    const discord = adapter('discord');

    const merged = mergeChannelsConfigs([
      contribution('SlackIntegration', { adapters: { slack } }),
      contribution('DiscordIntegration', { adapters: { discord } }),
    ]);

    expect(Object.keys(merged.adapters)).toEqual(['slack', 'discord']);
    expect(merged.adapters).toEqual({ slack, discord });
  });

  it('fails loud when two integrations contribute the same adapter key', () => {
    expect(() =>
      mergeChannelsConfigs([
        contribution('SlackIntegration', { adapters: { slack: adapter('self-hosted') } }),
        contribution('PlatformSlackIntegration', { adapters: { slack: adapter('platform') } }),
      ]),
    ).toThrow(
      "MastraFactory: integrations [SlackIntegration, PlatformSlackIntegration] both contribute a channel adapter under key 'slack'; only one integration may own a given platform adapter.",
    );
  });

  it('merges handlers when integrations own different slots', () => {
    const onDirectMessage = async () => {};
    const onMention = async () => {};

    const merged = mergeChannelsConfigs([
      contribution('SlackIntegration', {
        adapters: { slack: adapter('slack') },
        handlers: { onDirectMessage },
      }),
      contribution('DiscordIntegration', {
        adapters: { discord: adapter('discord') },
        handlers: { onMention },
      }),
    ]);

    expect(merged.handlers).toEqual({ onDirectMessage, onMention });
  });

  it('fails loud when two integrations set the same handler slot', () => {
    expect(() =>
      mergeChannelsConfigs([
        contribution('SlackIntegration', {
          adapters: { slack: adapter('slack') },
          handlers: { onMention: async () => {} },
        }),
        contribution('DiscordIntegration', {
          adapters: { discord: adapter('discord') },
          handlers: { onMention: async () => {} },
        }),
      ]),
    ).toThrow(/\[SlackIntegration, DiscordIntegration\].*handler 'onMention'/);
  });

  it('treats false as a handler-slot writer', () => {
    expect(() =>
      mergeChannelsConfigs([
        contribution('SlackIntegration', {
          adapters: { slack: adapter('slack') },
          handlers: { onMention: false },
        }),
        contribution('DiscordIntegration', {
          adapters: { discord: adapter('discord') },
          handlers: { onMention: false },
        }),
      ]),
    ).toThrow(/\[SlackIntegration, DiscordIntegration\].*handler 'onMention'/);
  });

  it('omits handlers when no contribution sets a handler slot', () => {
    const merged = mergeChannelsConfigs([
      contribution('SlackIntegration', { adapters: { slack: adapter('slack') }, handlers: {} }),
      contribution('DiscordIntegration', { adapters: { discord: adapter('discord') } }),
    ]);

    expect(merged).not.toHaveProperty('handlers');
  });

  const singleWriterFields = [
    ['inlineMedia', []],
    ['inlineLinks', []],
    ['state', {}],
    ['userName', ''],
    ['threadContext', { maxMessages: 0, addSystemMessage: false }],
    ['tools', false],
    ['chatOptions', {}],
    ['resolveResourceId', () => 'resource'],
    ['resolveThreadId', () => 'thread'],
    ['waitUntil', () => undefined],
    ['resolveWaitUntil', () => undefined],
  ] as const satisfies readonly (readonly [Exclude<keyof FactoryChannelsConfig, 'adapters' | 'handlers'>, unknown])[];

  it.each(singleWriterFields)('fails loud when two integrations set channels field %s', (field, value) => {
    expect(() =>
      mergeChannelsConfigs([
        contribution('SlackIntegration', {
          adapters: { slack: adapter('slack') },
          [field]: value,
        }),
        contribution('DiscordIntegration', {
          adapters: { discord: adapter('discord') },
          [field]: value,
        }),
      ]),
    ).toThrow(new RegExp(`\\[SlackIntegration, DiscordIntegration\\].*field '${field}'`));
  });

  it('returns a single contribution config unchanged', () => {
    const config: FactoryChannelsConfig = {
      adapters: { slack: adapter('slack') },
      handlers: {},
      tools: false,
    };

    expect(mergeChannelsConfigs([contribution('SlackIntegration', config)])).toBe(config);
  });

  it('throws on zero contributions to expose a call-site bug', () => {
    expect(() => mergeChannelsConfigs([])).toThrow(/call site bug/i);
  });

  it('enumerates every ChannelConfig field explicitly', () => {
    const everyFieldConfig: FactoryChannelsConfig = {
      adapters: { slack: adapter('slack') },
      handlers: { onMention: false },
      inlineMedia: [],
      inlineLinks: [],
      state: {} as never,
      userName: '',
      threadContext: { maxMessages: 0, addSystemMessage: false },
      tools: false,
      chatOptions: {},
      resolveResourceId: () => 'resource',
      resolveThreadId: () => 'thread',
      waitUntil: () => undefined,
      resolveWaitUntil: () => undefined,
    };

    expect(Object.keys(everyFieldConfig).sort()).toEqual([...CHANNEL_CONFIG_KEYS].sort());
  });
});
