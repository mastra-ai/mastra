import type { ConnectionCredential, ConnectionContext, ResolvedClient } from '../client.js';

/**
 * Structural minimum for the `Mastra({ channels })` value: a channel provider
 * exposes an `id`, produces HTTP routes to merge into the server, and can
 * optionally attach to a Mastra instance and perform async initialization.
 * Kept structural (not a nominal import from `@mastra/core`) so consumers
 * built against slightly different core minor versions still line up.
 */
export interface ChannelProviderLike {
  readonly id: string;
  getRoutes(): unknown[];
  __attach?(mastra: unknown): void;
  initialize?(): Promise<void> | void;
}

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
 * Registers one channel-capable provider with `channels()`. Mirrors the
 * tools-side `ProviderRegistration` shape: an `integrationId` for matching
 * the project connection, an `envVar` fallback for choosing between multiple
 * active connections, and a `build()` that materializes the channel provider
 * from the credential (plus per-integration `providerOptions`).
 */
export interface ChannelProviderRegistration<Options = Record<string, unknown>> {
  /** Platform catalog id used to match project connections (e.g. 'slack', 'telegram', 'discord'). */
  integrationId: string;
  /** Fallback connection-id environment variable when more than one active connection exists. */
  envVar: string;
  /**
   * Build a `ChannelProvider` (or shim conforming to `ChannelProviderLike`)
   * from a resolved credential. Peer packages are imported inside `build()`
   * with `await import()` so they stay optional at install time.
   */
  build(
    credential: ConnectionCredential,
    options?: Options,
    context?: ChannelBuildContext,
  ): Promise<ChannelProviderLike>;
}
