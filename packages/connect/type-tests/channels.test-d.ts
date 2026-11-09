import type { ChannelProvider, ChannelsResolver as CoreChannelsResolver } from '@mastra/core/channels';

import type { ChannelsOptions, ChannelsProviders, ChannelsResolver } from '../src/channels.js';

// The value awaited from `channels()` must satisfy `@mastra/core`'s
// `ChannelsResolver` contract so it can be handed to `new Mastra({ channels })`
// directly (callable + getRoutes()).
declare const resolver: ChannelsResolver;
const asMastraChannels: CoreChannelsResolver = resolver;
void asMastraChannels;

// The callable form returns the provider map of connected providers.
declare const called: Awaited<ReturnType<ChannelsResolver>>;
const asProviderMap: Record<string, ChannelProvider> = called;
void asProviderMap;

// `.refresh()` returns the same shape.
declare const refreshed: Awaited<ReturnType<ChannelsResolver['refresh']>>;
const asProviderMap2: Record<string, ChannelProvider> = refreshed;
void asProviderMap2;

// ---------------------------------------------------------------------------
// providers option shapes.
// ---------------------------------------------------------------------------

// Legal: the array allowlist form.
const legalArrayForm: ChannelsOptions = {
  projectId: 'proj_x',
  providers: ['discord', 'telegram'],
};
void legalArrayForm;

// Legal: boolean shorthands mixed with option objects.
const legalBooleanShorthand: ChannelsOptions = {
  projectId: 'proj_x',
  providers: {
    discord: true,
    'slack-channels': false,
    telegram: { connectionId: 'tel_123' },
  },
};
void legalBooleanShorthand;

// Legal: `slack` alias for `slack-channels`, with the Slack-specialized
// providerOptions shape (reserved fields still rejected below).
const legalSlackAlias: ChannelsOptions = {
  projectId: 'proj_x',
  providers: {
    slack: { connectionId: 'conn_slack_prod', providerOptions: { appName: 'My Bot' } },
  },
};
void legalSlackAlias;

// Illegal: the alias carries the same reserved-field enforcement as the
// canonical key.
const illegalSlackAliasReserved: ChannelsProviders = {
  // @ts-expect-error -- token is a reserved Slack provider option
  slack: { providerOptions: { token: 'xoxb-leak' } },
};
void illegalSlackAliasReserved;

// ---------------------------------------------------------------------------
// providerOptions reserved-field enforcement.
//
// Each entry rejects credential + framework-managed fields at compile time so
// consumers can't pass a token, a base URL, or an encryption key through
// `providerOptions`. Non-reserved fields flow through unchanged. The map is
// typed as `ChannelsProviders` directly so the error is reported on the
// per-channel line the directive sits above.
// ---------------------------------------------------------------------------

// Legal: non-reserved provider fields are allowed for every integration.
const legalProviders: ChannelsProviders = {
  'slack-channels': { providerOptions: { defaultChannel: 'C123', streaming: { enabled: true } } },
  telegram: { providerOptions: { mode: 'webhook', typingStatus: true } },
  discord: { providerOptions: { applicationId: 'a', publicKey: 'p', commandScope: 'global' } },
};
void legalProviders;

// The @ts-expect-error assertions below must fail-to-compile if the reserved
// field ever becomes acceptable — a green typecheck without them would be a
// regression.

const illegalSlackBaseUrl: ChannelsProviders = {
  // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
  'slack-channels': { providerOptions: { baseUrl: 'https://example.com' } },
};
void illegalSlackBaseUrl;

const illegalSlackRefreshToken: ChannelsProviders = {
  // @ts-expect-error refreshToken is credential-managed and cannot be passed here.
  'slack-channels': { providerOptions: { refreshToken: 'xoxe-1-abc' } },
};
void illegalSlackRefreshToken;

const illegalSlackToken: ChannelsProviders = {
  // @ts-expect-error token is credential-managed and cannot be passed here.
  'slack-channels': { providerOptions: { token: 'xoxe-2-abc' } },
};
void illegalSlackToken;

const illegalSlackEncryptionKey: ChannelsProviders = {
  // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
  'slack-channels': { providerOptions: { encryptionKey: 'k' } },
};
void illegalSlackEncryptionKey;

const illegalTelegramBaseUrl: ChannelsProviders = {
  // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
  telegram: { providerOptions: { baseUrl: 'https://example.com' } },
};
void illegalTelegramBaseUrl;

const illegalTelegramApiBaseUrl: ChannelsProviders = {
  // @ts-expect-error apiBaseUrl is framework-managed and cannot be passed here.
  telegram: { providerOptions: { apiBaseUrl: 'https://api.telegram.org' } },
};
void illegalTelegramApiBaseUrl;

const illegalTelegramBotToken: ChannelsProviders = {
  // @ts-expect-error botToken is credential-managed and cannot be passed here.
  telegram: { providerOptions: { botToken: '123:abc' } },
};
void illegalTelegramBotToken;

const illegalDiscordBaseUrl: ChannelsProviders = {
  // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
  discord: { providerOptions: { baseUrl: 'https://example.com' } },
};
void illegalDiscordBaseUrl;

const illegalDiscordEncryptionKey: ChannelsProviders = {
  // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
  discord: { providerOptions: { encryptionKey: 'k' } },
};
void illegalDiscordEncryptionKey;
