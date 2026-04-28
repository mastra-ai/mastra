import { z } from 'zod';

/**
 * Zod schemas for Slack channel data stored in ChannelsStorage.
 * These define the shape of the `data` JSON blob in ChannelInstallation records.
 */

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
}

export interface SlackConfigTokens {
  configToken: string;
  refreshToken: string;
  updatedAt: Date;
}
