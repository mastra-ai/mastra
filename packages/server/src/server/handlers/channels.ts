import type { Mastra } from '@mastra/core';
import type { ChannelProvider } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/di';
import { coreFeatures } from '@mastra/core/features';

import { MASTRA_USER_KEY } from '../constants';
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

import { assertWriteAccess, getCallerAuthorId, hasAdminBypass, hasScopedPermission } from './authorship';
import { handleError } from './error';

// ============================================================================
// Feature gate + helpers
// ============================================================================

function assertChannelsAvailable(): void {
  if (!coreFeatures.has('channels')) {
    throw new HTTPException(501, { message: 'Channels require a newer version of @mastra/core' });
  }
}

function getChannelOrThrow(mastra: Mastra, platform: string): ChannelProvider {
  const channels = Object.values(mastra.channels ?? {});
  const channel = channels.find(c => c.id === platform);
  if (!channel) {
    const available = channels.map(c => c.id).join(', ');
    throw new HTTPException(404, {
      message: `Channel "${platform}" is not registered. Available: ${available || 'none'}`,
    });
  }
  return channel;
}

/**
 * Unified connect/disconnect authorization.
 *
 * - Stored agent exists → same write access as editing the agent record.
 * - Code-defined agent (no stored record) → route's `requiresAuth` is the gate.
 * - Agent doesn't exist anywhere:
 *   - connect → 404 (can't connect a channel to a non-existent agent)
 *   - disconnect → orphan cleanup, gated on `channels:write`
 */
async function assertChannelAgentWriteAccess(
  mastra: Mastra,
  requestContext: RequestContext,
  agentId: string,
  action: 'connect' | 'disconnect',
): Promise<void> {
  const storage = mastra.getStorage();
  const agentsStore = storage ? await storage.getStore('agents') : null;
  const stored = agentsStore ? await agentsStore.getById(agentId) : null;

  if (stored) {
    assertWriteAccess({
      requestContext,
      resource: 'agents',
      resourceId: agentId,
      action: 'edit',
      record: stored,
    });
    return;
  }

  // Not in stored-agents (or storage doesn't support it). Check the runtime
  // registry for a code-defined agent.
  const codeDefined = mastra.getAgentById(agentId);
  if (codeDefined) {
    // Code-defined agents have no owner/ACL — route's requiresAuth /
    // requiresPermission is the gate. Pass-through.
    return;
  }

  if (action === 'connect') {
    throw new HTTPException(404, { message: `Agent "${agentId}" not found` });
  }

  // Disconnect against an unknown agentId = orphan cleanup (stored agent was
  // deleted but the channel installation row is still around). Allow it, but
  // gate on channels:write so this isn't an "any authenticated user" backdoor.
  // Follow the same no-auth-configured pass-through as assertWriteAccess.
  const callerAuthorId = getCallerAuthorId(requestContext);
  if (!callerAuthorId && !requestContext.get(MASTRA_USER_KEY)) return;
  if (hasAdminBypass(requestContext, 'channels')) return;
  if (hasScopedPermission({ requestContext, resource: 'channels', action: 'write' })) return;

  throw new HTTPException(404, { message: 'Not found' });
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
      const channels = Object.values(mastra.channels ?? {});
      return channels.map(channel => {
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
  handler: async ({ mastra, requestContext, platform, agentId, options }) => {
    assertChannelsAvailable();
    try {
      const channel = getChannelOrThrow(mastra, platform);

      if (!channel.connect) {
        throw new HTTPException(400, {
          message: `Channel "${platform}" does not support programmatic connection`,
        });
      }

      await assertChannelAgentWriteAccess(mastra, requestContext, agentId, 'connect');

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
  handler: async ({ mastra, requestContext, platform, agentId }) => {
    assertChannelsAvailable();
    try {
      const channel = getChannelOrThrow(mastra, platform);

      if (!channel.disconnect) {
        throw new HTTPException(400, {
          message: `Channel "${platform}" does not support programmatic disconnection`,
        });
      }

      await assertChannelAgentWriteAccess(mastra, requestContext, agentId, 'disconnect');

      await channel.disconnect(agentId);
      return { success: true };
    } catch (error) {
      return handleError(error, 'Error disconnecting agent from channel');
    }
  },
});
