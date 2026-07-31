/**
 * `Messaging` — the chat-platform capability, peer of {@link Intake} and
 * {@link VersionControl} on `FactoryIntegration`.
 *
 * A messaging-bearing integration (`SlackIntegration`, `PlatformSlackIntegration`,
 * future `DiscordIntegration`, …) contributes:
 *
 * 1. A {@link FactoryChannelsConfig} slice describing the platform's adapter,
 *    handlers, and resolvers — the factory merges every integration's slice
 *    into one `AgentControllerChannels` at boot.
 * 2. A workspace-context resolver that maps an inbound sender's platform
 *    identity (`{ platform, externalTeamId, externalUserId }`) to a Mastra
 *    tenant (`orgId`, `userId`) and default factory project, or `null` when the
 *    sender has not linked an account yet. Slack's account-linking gate uses
 *    this to decide whether to run under a user's credentials or post an
 *    ephemeral Connect card; every future channels integration will need the
 *    same mapping.
 *
 * Mutual-exclusion contract: at most one integration may own any given
 * platform-adapter key (`'slack'`, `'discord'`, …) across all integrations
 * registered on a factory. `SlackIntegration` and `PlatformSlackIntegration`
 * both use the `'slack'` key and are therefore mutually exclusive at boot —
 * a tenant picks self-hosted OR platform-managed, not both. The factory's
 * merge helper fails loud with an error naming both integration classes when
 * two contributions collide on any single slot (adapter key, handler slot,
 * resolver).
 *
 * Failure to resolve a sender is a nullable return, not a throw — an unlinked
 * sender is a normal runtime state (the user hasn't clicked Connect yet), not
 * an infrastructure error.
 */

import type { FactoryChannelAdapterEntry, FactoryChannelsConfig, IntegrationContext } from '../integrations/base.js';

export type { FactoryChannelAdapterEntry, FactoryChannelsConfig };

/**
 * Platform-neutral reference to an inbound sender. Carries only what's needed
 * to look up an existing account link — no display names, no message payload.
 */
export interface MessagingSenderRef {
  /** Platform identity — matches the adapter key in {@link FactoryChannelsConfig.adapters}. */
  platform: string;
  /** External workspace / team identifier (Slack team id, Discord guild id, …). */
  externalTeamId: string;
  /** External user identifier within that workspace. */
  externalUserId: string;
}

/**
 * Resolved workspace context for an inbound sender: the tenant to run under
 * and the default factory project to route sessions to. `defaultFactoryProjectId`
 * is `null` when the tenant has a factory but no explicit default project link
 * for this workspace (the caller decides whether to prompt or fall through).
 */
export interface MessagingWorkspaceContext {
  orgId: string;
  userId: string;
  defaultFactoryProjectId: string | null;
}

/** Fixed chat-platform contract implemented by Slack, Discord, and future channel providers. */
export interface Messaging {
  /**
   * Build this integration's channels contribution. Called once per boot for
   * READY integrations; the factory merges every contribution into a single
   * `AgentControllerChannels` and calls `setChannels` once.
   */
  channels(ctx: IntegrationContext): FactoryChannelsConfig;
  /**
   * Resolve a sender's platform identity to a Mastra tenant plus default
   * factory project. Returns `null` when the sender has no account link yet
   * (a normal runtime state, not an error). Adapters that require infra
   * (storage) MUST throw only on infrastructure failures — never for policy
   * misses like "no link" or "no default project".
   */
  resolveWorkspaceContext(
    ctx: IntegrationContext,
    senderRef: MessagingSenderRef,
  ): Promise<MessagingWorkspaceContext | null>;
}
