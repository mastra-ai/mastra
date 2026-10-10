import { StorageDomain } from '../base';

/**
 * Generic channel installation record.
 * Stores platform-specific data as JSON for flexibility.
 */
export interface ChannelInstallation {
  /** Unique installation ID */
  id: string;
  /** Platform identifier (e.g., 'slack', 'discord') */
  platform: string;
  /** Agent ID this installation is for */
  agentId: string;
  /** Installation status */
  status: 'pending' | 'active' | 'error';
  /** Webhook ID for routing inbound requests */
  webhookId?: string;
  /** Platform-specific data (tokens, team info, etc.) - stored encrypted */
  data: Record<string, unknown>;
  /** Hash of the agent's channel config + baseUrl - used to detect changes */
  configHash?: string;
  /** Error message if status is 'error' */
  error?: string;
  /** When the installation was created */
  createdAt: Date;
  /** When the installation was last updated */
  updatedAt: Date;
}

/**
 * Platform-level configuration for channel integrations.
 * Stores admin credentials needed for app factory (e.g., Slack App Configuration Tokens).
 * Each platform defines its own config shape - stored as encrypted JSON.
 */
export interface ChannelConfig {
  /** Platform identifier (e.g., 'slack', 'telegram', 'discord') */
  platform: string;
  /** Platform-specific configuration data - stored encrypted */
  data: Record<string, unknown>;
  /** When the config was last updated */
  updatedAt: Date;
}

/**
 * Mapping from a channel thread (per platform and owning agent) to a Mastra thread.
 * Replaces metadata scans on `mastra_threads` with an indexed point read.
 */
export interface ChannelThreadMapping {
  /** Platform identifier (e.g., 'slack', 'discord') */
  platform: string;
  /** Owner (agent or controller id) that this mapping belongs to */
  ownerId: string;
  /** Platform thread id as seen by the Chat SDK (e.g., 'slack:C123:1700000000.000100') */
  externalThreadId: string;
  /** Platform channel id the thread lives in */
  externalChannelId: string;
  /** Mastra thread id. Immutable once the row exists. */
  threadId: string;
  /** Whether the owner is subscribed to the thread */
  subscribed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Composite key of a channel thread mapping. */
export type ChannelThreadKey = Pick<ChannelThreadMapping, 'platform' | 'ownerId' | 'externalThreadId'>;

/** Input for upserting a channel thread mapping. `subscribed` defaults to false on insert. */
export type ChannelThreadMappingInput = Omit<ChannelThreadMapping, 'createdAt' | 'updatedAt' | 'subscribed'> & {
  subscribed?: boolean;
};

/**
 * Storage domain for channel installations and configuration.
 * Provides persistence for multi-platform channel integrations.
 */
export abstract class ChannelsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'CHANNELS',
    });
  }

  /**
   * Save or update a channel installation.
   */
  abstract saveInstallation(installation: ChannelInstallation): Promise<void>;

  /**
   * Get an installation by ID.
   */
  abstract getInstallation(id: string): Promise<ChannelInstallation | null>;

  /**
   * Get an installation by platform and agent ID.
   */
  abstract getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null>;

  /**
   * Get an installation by webhook ID (for routing inbound requests).
   */
  abstract getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null>;

  /**
   * List all installations for a platform.
   */
  abstract listInstallations(platform: string): Promise<ChannelInstallation[]>;

  /**
   * Delete an installation.
   */
  abstract deleteInstallation(id: string): Promise<void>;

  /**
   * Save platform configuration (e.g., Slack App Configuration Tokens, Telegram parent bot token).
   */
  abstract saveConfig(config: ChannelConfig): Promise<void>;

  /**
   * Get platform configuration.
   */
  abstract getConfig(platform: string): Promise<ChannelConfig | null>;

  /**
   * Delete platform configuration.
   */
  abstract deleteConfig(platform: string): Promise<void>;

  /**
   * Get the thread mapping for a channel thread, or null when none exists.
   * Optional: stores that do not implement thread mappings fall back to thread metadata scans.
   */
  getThreadMapping?(key: ChannelThreadKey): Promise<ChannelThreadMapping | null>;

  /**
   * Reverse lookup: get the mapping that points at a Mastra thread id.
   * Optional. Not called by core today; provided for consumers that resolve a channel
   * thread from a Mastra thread id and would otherwise scan thread metadata.
   */
  getThreadMappingByThreadId?(threadId: string): Promise<ChannelThreadMapping | null>;

  /**
   * Insert a thread mapping, or update an existing one for the same key.
   * On insert `subscribed` defaults to false when omitted. On conflict `threadId` is never
   * changed, `externalChannelId` is replaced, `subscribed` is set only when provided,
   * `updatedAt` is bumped and `createdAt` is kept. Returns the row as stored, so a caller
   * that passed a different `threadId` sees the existing one.
   * Optional.
   */
  upsertThreadMapping?(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping>;

  /**
   * Flip the subscription flag on an existing mapping. No-op when no row exists.
   * Optional.
   */
  setThreadSubscribed?(key: ChannelThreadKey, subscribed: boolean): Promise<void>;

  /**
   * Delete a thread mapping. No-op when no row exists.
   * Optional.
   */
  deleteThreadMapping?(key: ChannelThreadKey): Promise<void>;
}

type ThreadMappingMethods =
  | 'getThreadMapping'
  | 'getThreadMappingByThreadId'
  | 'upsertThreadMapping'
  | 'setThreadSubscribed'
  | 'deleteThreadMapping';

/**
 * Type guard: true when the store implements all five optional thread mapping methods.
 */
export function supportsThreadMappings(
  store: ChannelsStorage,
): store is ChannelsStorage & Required<Pick<ChannelsStorage, ThreadMappingMethods>> {
  return (
    typeof store.getThreadMapping === 'function' &&
    typeof store.getThreadMappingByThreadId === 'function' &&
    typeof store.upsertThreadMapping === 'function' &&
    typeof store.setThreadSubscribed === 'function' &&
    typeof store.deleteThreadMapping === 'function'
  );
}
