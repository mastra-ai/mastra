import type { ChannelProvider } from '@mastra/core/channels';

import type { ChannelsOptions, ChannelsResolver } from '../src/channels.js';

// The value awaited from `channels()` must be structurally assignable to the
// shape `Mastra({ channels })` accepts: `Record<string, ChannelProvider>`.
declare const resolver: ChannelsResolver;

// `await channels({...})` must resolve to a Record<string, ChannelProvider>.
declare const resolved: Awaited<ChannelsResolver>;
const asMastraChannels: Record<string, ChannelProvider> = resolved;
void asMastraChannels;

// The callable form returns the same map, useful for tests that inspect it.
declare const called: Awaited<ReturnType<ChannelsResolver>>;
const asMastraChannels2: Record<string, ChannelProvider> = called;
void asMastraChannels2;

// `.refresh()` returns the same shape.
declare const refreshed: Awaited<ReturnType<ChannelsResolver['refresh']>>;
const asMastraChannels3: Record<string, ChannelProvider> = refreshed;
void asMastraChannels3;

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
  integrations: {
    slack: { providerOptions: { defaultChannel: 'C123', streaming: { enabled: true } } },
    telegram: { providerOptions: { mode: 'webhook', typingStatus: true } },
    discord: { providerOptions: { applicationId: 'a', publicKey: 'p', commandScope: 'global' } },
  },
};
void legalOptions;

// The @ts-expect-error assertions below must fail-to-compile if the reserved
// field ever becomes acceptable — a green typecheck without them would be a
// regression.

const illegalSlackBaseUrl: ChannelsOptions = {
  integrations: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    slack: { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalSlackBaseUrl;

const illegalSlackRefreshToken: ChannelsOptions = {
  integrations: {
    // @ts-expect-error refreshToken is credential-managed and cannot be passed here.
    slack: { providerOptions: { refreshToken: 'xoxe-1-abc' } },
  },
};
void illegalSlackRefreshToken;

const illegalSlackToken: ChannelsOptions = {
  integrations: {
    // @ts-expect-error token is credential-managed and cannot be passed here.
    slack: { providerOptions: { token: 'xoxe-2-abc' } },
  },
};
void illegalSlackToken;

const illegalSlackEncryptionKey: ChannelsOptions = {
  integrations: {
    // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
    slack: { providerOptions: { encryptionKey: 'k' } },
  },
};
void illegalSlackEncryptionKey;

const illegalTelegramBaseUrl: ChannelsOptions = {
  integrations: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    telegram: { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalTelegramBaseUrl;

const illegalTelegramApiBaseUrl: ChannelsOptions = {
  integrations: {
    // @ts-expect-error apiBaseUrl is framework-managed and cannot be passed here.
    telegram: { providerOptions: { apiBaseUrl: 'https://api.telegram.org' } },
  },
};
void illegalTelegramApiBaseUrl;

const illegalTelegramBotToken: ChannelsOptions = {
  integrations: {
    // @ts-expect-error botToken is credential-managed and cannot be passed here.
    telegram: { providerOptions: { botToken: '123:abc' } },
  },
};
void illegalTelegramBotToken;

const illegalDiscordBaseUrl: ChannelsOptions = {
  integrations: {
    // @ts-expect-error baseUrl is framework-managed and cannot be passed here.
    discord: { providerOptions: { baseUrl: 'https://example.com' } },
  },
};
void illegalDiscordBaseUrl;

const illegalDiscordEncryptionKey: ChannelsOptions = {
  integrations: {
    // @ts-expect-error encryptionKey is process-wide and cannot be passed here.
    discord: { providerOptions: { encryptionKey: 'k' } },
  },
};
void illegalDiscordEncryptionKey;
