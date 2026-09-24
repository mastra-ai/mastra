import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionCredential, ConnectionContext, ResolvedClient } from '../client.js';

/**
 * Extra inputs a channel contributor may need beyond the raw credential:
 * durable non-secret metadata that lives on the platform connection (e.g.
 * Discord's `applicationId` + `publicKey`), and a resolved client for
 * follow-up lookups when necessary.
 */
export interface ChannelBuildContext {
  connectionId: string;
  context?: ConnectionContext;
  client: ResolvedClient;
}

/**
 * Registers one channel-capable provider with `channels()`. An `integrationId`
 * matches the project connection and `build()` materializes a Mastra
 * `ChannelProvider` from the credential (plus per-integration
 * `providerOptions`). Ambiguity is handled at the resolver level (`channels()`
 * warns and picks the first active connection when more than one is present)
 * so registrations stay minimal.
 */
export interface ChannelProviderRegistration<Options = Record<string, unknown>> {
  /** Platform catalog id used to match project connections (e.g. 'slack', 'telegram', 'discord'). */
  integrationId: string;
  /**
   * Build a Mastra `ChannelProvider` from a resolved credential. Peer packages
   * are imported inside `build()` with `await import()` so they stay optional
   * at install time.
   */
  build(credential: ConnectionCredential, options?: Options, context?: ChannelBuildContext): Promise<ChannelProvider>;
}
