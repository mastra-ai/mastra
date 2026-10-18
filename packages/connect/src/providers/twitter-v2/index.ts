// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createTwitterV2Tools } from './tools.js';

export const twitterV2Provider: ProviderRegistration = {
  integrationId: 'twitter-v2',
  envVar: 'MASTRA_TWITTER_V2_CONNECTION_ID',
  createTools: createTwitterV2Tools,
};

export { createTwitterV2Tools };
