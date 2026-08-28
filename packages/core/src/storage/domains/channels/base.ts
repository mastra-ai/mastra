import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
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
 * A single channel state entry.
 * Wrapping the value keeps a stored `null` distinguishable from a missing key.
 */
export interface ChannelStateEntry {
  value: unknown;
}

function channelStateUnsupported(method: string): MastraError {
  return new MastraError({
    id: 'MASTRA_STORAGE_CHANNEL_STATE_NOT_SUPPORTED',
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.SYSTEM,
    text: `This storage adapter does not support shared channel state (${method}). Upgrade the storage package to a version that implements it.`,
    details: { method },
  });
}
/**
 * Storage domain for channel installations, configuration, and shared runtime state.
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
   * Whether this store implements the shared state methods below.
   *
   * The state methods were added after the channels domain shipped, so a store package
   * older than the running core implements this class without them. Callers must check
   * this flag rather than the presence of the domain, or a version-skewed deployment
   * fails at the call site instead of falling back to per-process state.
   */
  readonly supportsChannelState?: boolean = false;

  /**
   * Read a state entry. Returns `null` when the key is missing or expired.
   *
   * @throws {MastraError} when the store does not support shared channel state.
   */
  async getState(_ownerId: string, _key: string): Promise<ChannelStateEntry | null> {
    throw channelStateUnsupported('getState');
  }

  /**
   * Write a state entry, overwriting any existing one.
   *
   * `expiresAt` is an absolute epoch-ms deadline, or `null` to never expire. Callers pass
   * a deadline rather than a duration so the store never has to read the clock.
   *
   * @throws {MastraError} when the store does not support shared channel state.
   */
  async setState(_ownerId: string, _key: string, _value: unknown, _expiresAt: number | null): Promise<void> {
    throw channelStateUnsupported('setState');
  }

  /**
   * Claim a key: write the entry only if no live one exists, and report whether this
   * caller won. An expired entry is claimable. Implementations must do this atomically,
   * because a read-then-write lets two processes both claim the same key.
   *
   * @throws {MastraError} when the store does not support shared channel state.
   */
  async setStateIfNotExists(
    _ownerId: string,
    _key: string,
    _value: unknown,
    _expiresAt: number | null,
  ): Promise<boolean> {
    throw channelStateUnsupported('setStateIfNotExists');
  }

  /**
   * Delete a state entry.
   *
   * @throws {MastraError} when the store does not support shared channel state.
   */
  async deleteState(_ownerId: string, _key: string): Promise<void> {
    throw channelStateUnsupported('deleteState');
  }

  /**
   * Delete every entry whose deadline is at or before `now` (epoch ms).
   *
   * @throws {MastraError} when the store does not support shared channel state.
   */
  async deleteExpiredState(_now: number): Promise<void> {
    throw channelStateUnsupported('deleteExpiredState');
  }
}
