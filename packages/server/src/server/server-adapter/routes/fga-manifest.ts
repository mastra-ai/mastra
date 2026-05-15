import type { FGARouteConfig, MastraFGAPermissionInput } from '@mastra/core/auth/ee';

import { MASTRA_RESOURCE_ID_KEY } from '../../constants';
import { getEffectivePermission } from './permissions';
import type { ServerRoute } from './index';

function isProtectedFGARoute(route: Pick<ServerRoute, 'requiresAuth'>): boolean {
  return route.requiresAuth !== false;
}

function getToolRoutePermission(path: string): MastraFGAPermissionInput {
  return path.includes('/execute') ? 'tools:execute' : 'tools:read';
}

function getAgentToolResourceId(agentId: string, toolId: string): string {
  return `${agentId}:${toolId}`;
}

function getMCPToolResourceId(serverId: string, toolId: string): string {
  return JSON.stringify([serverId, toolId]);
}

const STORED_ROUTE_FGA: Record<string, { resourceType: string; idParams: string[] }> = {
  agents: { resourceType: 'stored-agents', idParams: ['storedAgentId', 'agentId'] },
  'mcp-clients': { resourceType: 'stored-mcp-clients', idParams: ['storedMCPClientId', 'mcpClientId'] },
  'prompt-blocks': { resourceType: 'stored-prompt-blocks', idParams: ['storedPromptBlockId', 'promptBlockId'] },
  scorers: { resourceType: 'stored-scorers', idParams: ['storedScorerId', 'scorerId'] },
  skills: { resourceType: 'stored-skills', idParams: ['storedSkillId'] },
  workspaces: { resourceType: 'stored-workspaces', idParams: ['storedWorkspaceId'] },
};

function getStoredResourceRouteFGAConfig(path: string, permission: MastraFGAPermissionInput): FGARouteConfig | null {
  const match = path.match(/^\/stored\/([^/]+)/);
  if (!match?.[1]) {
    return null;
  }

  const config = STORED_ROUTE_FGA[match[1]];
  if (!config) {
    return null;
  }

  return {
    resourceType: config.resourceType,
    resourceId: (params, { requestContext }) => {
      for (const idParam of config.idParams) {
        const id = params[idParam];
        if (typeof id === 'string' && id) {
          return id;
        }
      }

      const scopedResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
      return typeof scopedResourceId === 'string' && scopedResourceId ? scopedResourceId : config.resourceType;
    },
    permission,
  };
}

export function getBuiltInRouteFGAConfig(route: ServerRoute): FGARouteConfig | null {
  if (!isProtectedFGARoute(route) || !route.path || !route.method) {
    return null;
  }

  const permission = getEffectivePermission(route) as MastraFGAPermissionInput | null;
  if (!permission) {
    return null;
  }

  const path = route.path;
  const storedRouteConfig = getStoredResourceRouteFGAConfig(path, permission);
  if (storedRouteConfig) {
    return storedRouteConfig;
  }

  if (path.startsWith('/agents/:agentId/tools/:toolId')) {
    return {
      resourceType: 'tool',
      resourceId: ({ agentId, toolId }) => getAgentToolResourceId(String(agentId), String(toolId)),
      permission: getToolRoutePermission(path),
    };
  }

  if (path.startsWith('/agents/:agentId')) {
    return { resourceType: 'agent', resourceIdParam: 'agentId', permission };
  }

  if (path.startsWith('/workflows/:workflowId')) {
    return { resourceType: 'workflow', resourceIdParam: 'workflowId', permission };
  }

  if (path.startsWith('/tools/:toolId')) {
    return { resourceType: 'tool', resourceIdParam: 'toolId', permission };
  }

  if (path.startsWith('/mcp/:serverId/tools/:toolId')) {
    return {
      resourceType: 'tool',
      resourceId: ({ serverId, toolId }) => getMCPToolResourceId(String(serverId), String(toolId)),
      permission: getToolRoutePermission(path),
    };
  }

  if (path.startsWith('/mcp/:serverId')) {
    return { resourceType: 'mcp', resourceIdParam: 'serverId', permission };
  }

  if (path.startsWith('/memory/threads/:threadId') || path.startsWith('/memory/network/threads/:threadId')) {
    return { resourceType: 'thread', resourceIdParam: 'threadId', permission };
  }

  if (path === '/memory/threads' || path === '/memory/network/threads') {
    return {
      resourceType: 'thread',
      resourceId: ({ threadId, resourceId }) => {
        if (typeof threadId === 'string') return threadId;
        return typeof resourceId === 'string' ? resourceId : undefined;
      },
      permission,
    };
  }

  if (path === '/memory/save-messages' || path === '/memory/network/save-messages') {
    return {
      resourceType: 'thread',
      resourceId: ({ messages }) => {
        if (!Array.isArray(messages)) return undefined;
        const threadId = messages.find(
          message => message && typeof message === 'object' && 'threadId' in message,
        )?.threadId;
        return typeof threadId === 'string' ? threadId : undefined;
      },
      permission,
    };
  }

  if (path === '/v1/responses') {
    return { resourceType: 'agent', resourceIdParam: 'agent_id', permission };
  }

  if (path.startsWith('/v1/responses/:responseId')) {
    return { resourceType: 'response', resourceIdParam: 'responseId', permission };
  }

  if (path === '/v1/conversations') {
    return { resourceType: 'agent', resourceIdParam: 'agent_id', permission };
  }

  if (path.startsWith('/v1/conversations/:conversationId')) {
    return { resourceType: 'conversation', resourceIdParam: 'conversationId', permission };
  }

  return null;
}
