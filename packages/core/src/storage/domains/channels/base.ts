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
}
