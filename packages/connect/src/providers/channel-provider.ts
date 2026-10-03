import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectionContext, ConnectionCredential, ResolvedClient } from '../client.js';

/**
 * Live view of one integration's platform connection, handed to
 * `ChannelProviderRegistration.create()`. The `channels()` resolver updates
 * the current connection on every resolution, so a registration's provider
 * and `sync()` closure always read the latest state through these accessors
 * instead of capturing a connection at construction time.
 */
export interface ChannelRuntime {
  /** Resolved platform client for follow-up lookups. */
  client: ResolvedClient;
  /** The currently-selected active connection id, or `undefined` when the integration has none. */
  getConnectionId(): string | undefined;
  /**
   * Fetches a fresh credential for the current connection. Never cached —
   * the platform's credential vendor owns token refresh, so each call may
   * return a newer token than the last. Throws when no connection is active.
   */
  getCredential(): Promise<ConnectionCredential>;
  /** Fetches the current connection's non-secret context (metadata), or `undefined` when unavailable. */
  getConnectionContext(): Promise<ConnectionContext | undefined>;
}

/**
 * A long-lived channel provider produced by a registration. The `provider`
 * instance survives across resolutions (its routes are mounted once, at
 * Mastra construction); `sync()` re-applies the current connection's
 * credential/metadata on each resolution while a connection is active.
 */
export interface ChannelInstance {
  provider: ChannelProvider;
  /**
   * Push the current connection's credential/metadata into the live
   * provider (via `provider.configure()` or equivalent). Called on every
   * resolution while a connection is active; implementations should be
   * cheap when nothing changed. Omit for providers that pull credentials
   * lazily themselves (e.g. Slack's `tokenResolver`).
   */
  sync?(): Promise<void>;
}

/**
 * Registers one channel-capable provider with `channels()`. An `integrationId`
 * matches the project connection; `create()` constructs the long-lived
 * provider once, credential-less. Ambiguity is handled at the resolver level
 * (`channels()` warns and picks the first active connection when more than
 * one is present) so registrations stay minimal.
 */
export interface ChannelProviderRegistration<Options = Record<string, unknown>> {
  /** Platform catalog id used to match project connections (e.g. 'slack', 'telegram', 'discord'). */
  integrationId: string;
  /**
   * Construct the long-lived Mastra `ChannelProvider`. Channel packages are
   * imported inside `create()` with `await import()` so only registrations
   * that aren't disabled pay the module-load cost. Must not call the
   * platform: construction happens before any connection is resolved, so
   * credentials arrive later through `runtime` (lazily, or on `sync()`).
   */
  create(options: Options | undefined, runtime: ChannelRuntime): Promise<ChannelInstance>;
}
