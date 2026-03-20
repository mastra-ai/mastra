import type { Adapter, StateAdapter } from 'chat';

import type { ChannelCommand } from '../types';

/**
 * Configuration for the ChatAdapterChannel bridge.
 */
export type ChatAdapterChannelConfig = {
  /**
   * A Chat SDK adapter instance (e.g. `new DiscordAdapter()` from `@chat-adapter/discord`).
   */
  adapter: Adapter;

  /**
   * The platform name. Used for thread metadata and routing.
   * Defaults to `adapter.name` if available.
   */
  platform?: string;

  /**
   * Slash commands this channel responds to.
   */
  commands?: Record<string, ChannelCommand>;

  /**
   * Optional Chat SDK StateAdapter for adapter-level caching/locking.
   * If not provided, an in-memory shim is used.
   */
  state?: StateAdapter;

  /**
   * Bot display name. Defaults to 'Mastra'.
   */
  userName?: string;
};
