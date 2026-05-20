import { z } from 'zod/v4';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const channelPlatformPathParams = z.object({
  platform: z.string().describe('Channel platform identifier (e.g., "slack")'),
});

export const channelAgentPathParams = z.object({
  platform: z.string().describe('Channel platform identifier (e.g., "slack")'),
  agentId: z.string().describe('Agent identifier'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

export const connectChannelBodySchema = z.object({
  agentId: z.string().describe('Agent identifier to connect'),
  options: z.record(z.string(), z.unknown()).optional().describe('Platform-specific connection options'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const channelPlatformInfoSchema = z.object({
  id: z.string().describe('Platform identifier'),
  name: z.string().describe('Human-readable platform name'),
  isConfigured: z.boolean().describe('Whether the platform is ready to connect agents'),
  connectOptionsSchema: z.record(z.string(), z.unknown()).optional().describe('JSON Schema for connect options'),
});

const channelInstallationInfoSchema = z.object({
  id: z.string().describe('Installation identifier'),
  platform: z.string().describe('Platform identifier'),
  agentId: z.string().describe('Connected agent identifier'),
  status: z.enum(['active', 'pending']).describe('Installation status'),
  displayName: z.string().optional().describe('Platform-specific display name'),
  installedAt: z.coerce.date().optional().describe('Installation timestamp'),
});

const channelConnectOAuthSchema = z.object({
  type: z.literal('oauth').describe('OAuth-based connection requiring browser redirect'),
  authorizationUrl: z.string().describe('OAuth authorization URL for user redirect'),
  installationId: z.string().describe('Installation identifier'),
});

const channelConnectDeepLinkSchema = z.object({
  type: z.literal('deep_link').describe('Deep-link connection requiring native app interaction'),
  url: z.string().describe('Deep link URL to open in platform app'),
  installationId: z.string().describe('Installation identifier'),
});

const channelConnectImmediateSchema = z.object({
  type: z.literal('immediate').describe('Immediate connection with no user interaction needed'),
  installationId: z.string().describe('Installation identifier'),
});

const channelConnectResultSchema = z.discriminatedUnion('type', [
  channelConnectOAuthSchema,
  channelConnectDeepLinkSchema,
  channelConnectImmediateSchema,
]);

export const listChannelPlatformsResponseSchema = z.array(channelPlatformInfoSchema);

export const listChannelInstallationsResponseSchema = z.array(channelInstallationInfoSchema);

export const connectChannelResponseSchema = channelConnectResultSchema;

export const disconnectChannelResponseSchema = z.object({
  success: z.boolean(),
});
