import { z } from 'zod';

/**
 * Zod schemas for Slack channel data stored in ChannelsStorage.
 * These define the shape of the `data` JSON blob in ChannelInstallation records.
 */

// =============================================================================
// Slash Command Schema (stored alongside installation)
// =============================================================================

export const SlashCommandSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  usageHint: z.string().optional(),
  prompt: z.string().optional(),
});

// =============================================================================
// Installation Data (stored in ChannelInstallation.data when status='active')
// =============================================================================

export const SlackInstallationDataSchema = z.object({
  appId: z.string(),
  clientId: z.string(),
  clientSecret: z.string(), // encrypted
  signingSecret: z.string(), // encrypted
  teamId: z.string(),
  teamName: z.string().optional(),
  botToken: z.string(), // encrypted
  botUserId: z.string(),
  slashCommands: z.array(SlashCommandSchema).optional(),
});

export type SlackInstallationData = z.infer<typeof SlackInstallationDataSchema>;

// =============================================================================
// Pending Installation Data (stored in ChannelInstallation.data when status='pending')
// =============================================================================

export const SlackPendingDataSchema = z.object({
  appId: z.string(),
  clientId: z.string(),
  clientSecret: z.string(), // encrypted
  signingSecret: z.string(), // encrypted
  authorizationUrl: z.string(),
  slashCommands: z.array(SlashCommandSchema).optional(),
});

export type SlackPendingData = z.infer<typeof SlackPendingDataSchema>;

// =============================================================================
// Config Tokens (stored in ChannelConfig.data)
// =============================================================================

export const SlackConfigDataSchema = z.object({
  configToken: z.string(), // encrypted
  refreshToken: z.string(), // encrypted
});

export type SlackConfigData = z.infer<typeof SlackConfigDataSchema>;

// =============================================================================
// Parsed Installation (combines ChannelInstallation fields + parsed data)
// =============================================================================

/** Normalized slash command config as stored in installation data. */
export type StoredSlashCommand = z.infer<typeof SlashCommandSchema>;

export interface SlackInstallation {
  id: string;
  agentId: string;
  webhookId: string;
  configHash: string;
  installedAt: Date;
  // From parsed data:
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  teamId: string;
  teamName?: string;
  botToken: string;
  botUserId: string;
  slashCommands?: StoredSlashCommand[];
}

export interface SlackPendingInstallation {
  id: string;
  agentId: string;
  webhookId: string;
  configHash: string;
  createdAt: Date;
  // From parsed data:
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  authorizationUrl: string;
  slashCommands?: StoredSlashCommand[];
}

export interface SlackConfigTokens {
  configToken: string;
  refreshToken: string;
  updatedAt: Date;
}
