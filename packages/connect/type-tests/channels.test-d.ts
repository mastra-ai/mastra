import type { ChannelProvider, ChannelsResolver as CoreChannelsResolver } from '@mastra/core/channels';

import type { ChannelsOptions, ChannelsResolver } from '../src/channels.js';

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
// providerOptions reserved-field enforcement.
//
// Each entry rejects credential + framework-managed fields at compile time so
// consumers can't pass a token, a base URL, or an encryption key through
// `providerOptions`. Non-reserved fields flow through unchanged.
// ---------------------------------------------------------------------------

// Legal: non-reserved provider fields are allowed for every integration.
const legalOptions: ChannelsOptions = {
  projectId: 'proj_x',
  providers: {
    'slack-channels': { providerOptions: { defaultChannel: 'C123', streaming: { enabled: true } } },
    telegram: { providerOptions: { mode: 'webhook', typingStatus: true } },
    discord: { providerOptions: { applicationId: 'a', publicKey: 'p', commandScope: 'global' } },
  },
};
void legalOptions;

// The @ts-expect-error assertions below must fail-to-compile if the reserved
// field ever becomes acceptable — a green typecheck without them would be a
// regression.

const illegalSlackBaseUrl: ChannelsOptions = {
  providers: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    'slack-channels': { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalSlackBaseUrl;

const illegalSlackRefreshToken: ChannelsOptions = {
  providers: {
    // @ts-expect-error refreshToken is credential-managed and cannot be passed here.
    'slack-channels': { providerOptions: { refreshToken: 'xoxe-1-abc' } },
  },
};
void illegalSlackRefreshToken;

const illegalSlackToken: ChannelsOptions = {
  providers: {
    // @ts-expect-error token is credential-managed and cannot be passed here.
    'slack-channels': { providerOptions: { token: 'xoxe-2-abc' } },
  },
};
void illegalSlackToken;

const illegalSlackEncryptionKey: ChannelsOptions = {
  providers: {
    // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
    'slack-channels': { providerOptions: { encryptionKey: 'k' } },
  },
};
void illegalSlackEncryptionKey;

const illegalTelegramBaseUrl: ChannelsOptions = {
  providers: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    telegram: { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalTelegramBaseUrl;

const illegalTelegramApiBaseUrl: ChannelsOptions = {
  providers: {
    // @ts-expect-error apiBaseUrl is framework-managed and cannot be passed here.
    telegram: { providerOptions: { apiBaseUrl: 'https://api.telegram.org' } },
  },
};
void illegalTelegramApiBaseUrl;

const illegalTelegramBotToken: ChannelsOptions = {
  providers: {
    // @ts-expect-error botToken is credential-managed and cannot be passed here.
    telegram: { providerOptions: { botToken: '123:abc' } },
  },
};
void illegalTelegramBotToken;

const illegalDiscordBaseUrl: ChannelsOptions = {
  providers: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    discord: { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalDiscordBaseUrl;

const illegalDiscordEncryptionKey: ChannelsOptions = {
  providers: {
    // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
    discord: { providerOptions: { encryptionKey: 'k' } },
  },
};
void illegalDiscordEncryptionKey;
