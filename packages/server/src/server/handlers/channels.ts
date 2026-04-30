import { coreFeatures } from '@mastra/core/features';

import { HTTPException } from '../http-exception';
import {
  channelPlatformPathParams,
  channelAgentPathParams,
  connectChannelBodySchema,
  listChannelPlatformsResponseSchema,
  listChannelInstallationsResponseSchema,
  connectChannelResponseSchema,
  disconnectChannelResponseSchema,
} from '../schemas/channels';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Feature gate + helpers
// ============================================================================

function assertChannelsAvailable(): void {
  if (!coreFeatures.has('channels')) {
    throw new HTTPException(501, { message: 'Channels require a newer version of @mastra/core' });
  }
}

function getChannelOrThrow(mastra: any, platform: string) {
  const channels = mastra.channels ?? {};
  const channel = Object.values(channels).find((c: any) => c.id === platform) as any;
  if (!channel) {
    const available = Object.values(channels)
      .map((c: any) => c.id)
      .join(', ');
    throw new HTTPException(404, {
      message: `Channel "${platform}" is not registered. Available: ${available || 'none'}`,
    });
  }
  return channel;
}

function assertAgentExists(mastra: any, agentId: string) {
  const agent = mastra.getAgentById?.(agentId);
  if (!agent) {
    throw new HTTPException(404, {
      message: `Agent "${agentId}" not found`,
    });
  }
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /channels/platforms - List available channel platforms
 */
export const LIST_CHANNEL_PLATFORMS_ROUTE = createRoute({
  method: 'GET',
  path: '/channels/platforms',
  responseType: 'json',
  responseSchema: listChannelPlatformsResponseSchema,
  summary: 'List channel platforms',
  description: 'Returns available channel platforms and their configuration status',
  tags: ['Channels'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    assertChannelsAvailable();
    try {
      const channels = (mastra as any).channels ?? {};
      return Object.values(channels).map((channel: any) => {
        if (channel.getInfo) {
          return channel.getInfo();
        }
        return {
          id: channel.id,
          name: channel.id.charAt(0).toUpperCase() + channel.id.slice(1),
          isConfigured: true,
        };
      });
    } catch (error) {
      return handleError(error, 'Error listing channel platforms');
    }
  },
});

/**
 * GET /channels/:platform/installations - List installations for a platform
 */
export const LIST_CHANNEL_INSTALLATIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/channels/:platform/installations',
  responseType: 'json',
  pathParamSchema: channelPlatformPathParams,
  responseSchema: listChannelInstallationsResponseSchema,
  summary: 'List channel installations',
  description: 'Returns all active and pending installations for a channel platform',
  tags: ['Channels'],
  requiresAuth: true,
  handler: async ({ mastra, platform }) => {
    assertChannelsAvailable();
    try {
      const channel = getChannelOrThrow(mastra, platform);

      if (!channel.listInstallations) {
        return [];
      }

      return await channel.listInstallations();
    } catch (error) {
      return handleError(error, 'Error listing channel installations');
    }
  },
});

/**
 * POST /channels/:platform/connect - Connect an agent to a platform
 */
export const CONNECT_CHANNEL_ROUTE = createRoute({
  method: 'POST',
  path: '/channels/:platform/connect',
  responseType: 'json',
  pathParamSchema: channelPlatformPathParams,
  bodySchema: connectChannelBodySchema,
  responseSchema: connectChannelResponseSchema,
  summary: 'Connect agent to channel',
  description: 'Creates a platform app for the agent and returns an OAuth authorization URL',
  tags: ['Channels'],
  requiresAuth: true,
  handler: async ({ mastra, platform, agentId, options }) => {
    assertChannelsAvailable();
    try {
      const channel = getChannelOrThrow(mastra, platform);

      if (!channel.connect) {
        throw new HTTPException(400, {
          message: `Channel "${platform}" does not support programmatic connection`,
        });
      }

      return await channel.connect(agentId, options);
    } catch (error) {
      return handleError(error, 'Error connecting agent to channel');
    }
  },
});

/**
 * POST /channels/:platform/:agentId/disconnect - Disconnect an agent from a platform
 */
export const DISCONNECT_CHANNEL_ROUTE = createRoute({
  method: 'POST',
  path: '/channels/:platform/:agentId/disconnect',
  responseType: 'json',
  pathParamSchema: channelAgentPathParams,
  responseSchema: disconnectChannelResponseSchema,
  summary: 'Disconnect agent from channel',
  description: 'Deletes the platform app and cleans up the installation',
  tags: ['Channels'],
  requiresAuth: true,
  handler: async ({ mastra, platform, agentId }) => {
    assertChannelsAvailable();
    try {
      assertAgentExists(mastra, agentId);
      const channel = getChannelOrThrow(mastra, platform);

      if (!channel.disconnect) {
        throw new HTTPException(400, {
          message: `Channel "${platform}" does not support programmatic disconnection`,
        });
      }

      await channel.disconnect(agentId);
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error disconnecting agent from channel');
    }
  },
});
