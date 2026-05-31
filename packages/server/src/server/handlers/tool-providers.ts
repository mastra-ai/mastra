import type { IMastraEditor } from '@mastra/core/editor';
import type { IMastraLogger } from '@mastra/core/logger';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { RequestContext } from '@mastra/core/request-context';
import type * as ToolProviderModule from '@mastra/core/tool-provider';
import type { ToolProvider } from '@mastra/core/tool-provider';

import { MASTRA_USER_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  authorizeToolProviderBodySchema,
  authorizeToolProviderResponseSchema,
  authStatusToolProviderResponseSchema,
  connectionStatusToolProviderBodySchema,
  connectionStatusToolProviderResponseSchema,
  connectionUsageQuerySchema,
  connectionUsageResponseSchema,
  disconnectConnectionQuerySchema,
  disconnectConnectionResponseSchema,
  getToolProviderToolSchemaResponseSchema,
  listConnectionFieldsQuerySchema,
  listConnectionFieldsResponseSchema,
  listConnectionsQuerySchema,
  listConnectionsResponseSchema,
  listToolProviderToolkitsResponseSchema,
  listToolProviderToolsQuerySchema,
  listToolProviderToolsResponseSchema,
  listToolProvidersResponseSchema,
  toolProviderAuthStatusPathParams,
  toolProviderConnectionPathParams,
  toolProviderHealthResponseSchema,
  toolProviderIdPathParams,
  toolSlugPathParams,
  updateConnectionBodySchema,
  updateConnectionResponseSchema,
} from '../schemas/tool-providers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { hasAdminBypass } from './authorship';
import { handleError } from './error';

const TOOL_PROVIDERS_RESOURCE = 'tool-providers' as const;

/**
 * Mirrors `@mastra/core/tool-provider#SHARED_BUCKET_ID`. Inlined locally so this
 * module evaluates under any peer-compatible core; a regression test in
 * `tool-providers.test.ts` verifies the literal stays in lockstep with core.
 */
const SHARED_BUCKET_ID = 'shared' as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Lazily import `@mastra/core/tool-provider` so this server module can evaluate
 * under any peer-compatible core. The new value exports (`UnknownToolProviderError`,
 * `SHARED_BUCKET_ID`) ship in core `>=1.39.0-0`; users on older cores who never
 * configure a `MastraEditor` short-circuit via `requireEditor` long before this
 * runs. ESM caches one module instance per resolved specifier so the
 * `instanceof` check below sees the same class identity that `@mastra/editor`
 * throws.
 */
let _toolProviderModule: typeof ToolProviderModule | undefined;
async function loadToolProviderModule() {
  if (!_toolProviderModule) {
    _toolProviderModule = await import('@mastra/core/tool-provider');
  }
  return _toolProviderModule;
}

function requireEditor(editor: IMastraEditor | undefined): IMastraEditor {
  if (!editor) {
    throw new HTTPException(500, { message: 'Editor is not configured' });
  }
  return editor;
}

async function resolveProvider(editor: IMastraEditor, providerId: string): Promise<ToolProvider> {
  try {
    return editor.getToolProviderOrThrow(providerId);
  } catch (error) {
    const { UnknownToolProviderError } = await loadToolProviderModule();
    if (error instanceof UnknownToolProviderError) {
      throw new HTTPException(404, { message: error.message });
    }
    throw error;
  }
}

// Emit a single warn per process when the connection-owner fallback fires.
// Multi-tenant deployments that forget to wire `mapUserToResourceId` (or
// `MASTRA_USER_KEY`) silently funnel every `caller-supplied` pin into one
// shared OAuth account — surface that misconfiguration once.
let defaultBucketWarned = false;
function warnDefaultBucketFallback(logger: IMastraLogger | undefined): void {
  if (defaultBucketWarned) return;
  defaultBucketWarned = true;
  logger?.warn(
    '[tool-providers] caller-supplied scope falling back to shared "default" bucket — ' +
      'wire mapUserToResourceId or set MASTRA_USER_KEY to avoid cross-tenant OAuth sharing',
  );
}

/**
 * Resolve the connection owner (provider `userId` bucket) from the caller's
 * `RequestContext`. Mirrors the runtime fan-out fallback to `'default'` when
 * no auth context is present so OSS deployments still work.
 */
function resolveOwnerId(requestContext: RequestContext | undefined, logger: IMastraLogger | undefined): string {
  const resourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
  if (typeof resourceId === 'string' && resourceId.length > 0) {
    return resourceId;
  }

  const user = requestContext?.get(MASTRA_USER_KEY);
  if (user && typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  warnDefaultBucketFallback(logger);
  return 'default';
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /tool-providers — List all registered tool providers with their
 * capabilities (when the provider exposes them).
 */
export const LIST_TOOL_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers',
  responseType: 'json',
  responseSchema: listToolProvidersResponseSchema,
  summary: 'List tool providers',
  description: 'Returns a list of all registered tool providers with their info and capabilities',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const providers = editor.getToolProviders();
      return {
        providers: Object.values(providers).map(provider => ({
          ...provider.info,
          ...(provider.displayName ? { displayName: provider.displayName } : {}),
          ...(provider.capabilities ? { capabilities: provider.capabilities } : {}),
        })),
      };
    } catch (error) {
      return handleError(error, 'Error listing tool providers');
    }
  },
});

/**
 * GET /tool-providers/:providerId/toolkits — Toolkits exposed by a provider.
 */
export const LIST_TOOL_PROVIDER_TOOLKITS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/toolkits',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  responseSchema: listToolProviderToolkitsResponseSchema,
  summary: 'List tool provider toolkits',
  description: 'Returns the toolkits available from a specific tool provider',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (provider.listToolkitsVNext) {
        return await provider.listToolkitsVNext();
      }
      if (provider.listToolkits) {
        return await provider.listToolkits();
      }
      return { data: [] };
    } catch (error) {
      return handleError(error, 'Error listing tool provider toolkits');
    }
  },
});

/**
 * GET /tool-providers/:providerId/tools — List tools, optionally filtered.
 */
export const LIST_TOOL_PROVIDER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/tools',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  queryParamSchema: listToolProviderToolsQuerySchema,
  responseSchema: listToolProviderToolsResponseSchema,
  summary: 'List tool provider tools',
  description: 'Returns the tools available from a specific tool provider, with optional filtering',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolkit, search, page, perPage }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      const opts: { toolkit?: string; search?: string; page?: number; perPage?: number } = {};
      if (toolkit !== undefined) opts.toolkit = toolkit;
      if (search !== undefined) opts.search = search;
      if (page !== undefined) opts.page = page;
      if (perPage !== undefined) opts.perPage = perPage;
      if (provider.listToolsVNext) {
        return await provider.listToolsVNext(Object.keys(opts).length > 0 ? opts : undefined);
      }
      return await provider.listTools(Object.keys(opts).length > 0 ? opts : undefined);
    } catch (error) {
      return handleError(error, 'Error listing tool provider tools');
    }
  },
});

/**
 * GET /tool-providers/:providerId/tools/:toolSlug/schema — Tool schema.
 */
export const GET_TOOL_PROVIDER_TOOL_SCHEMA_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/tools/:toolSlug/schema',
  responseType: 'json',
  pathParamSchema: toolSlugPathParams,
  responseSchema: getToolProviderToolSchemaResponseSchema,
  summary: 'Get tool provider tool schema',
  description: 'Returns the schema for a specific tool from a tool provider',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolSlug }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.getToolSchema) {
        throw new HTTPException(404, { message: `Tool provider ${providerId} does not support getToolSchema` });
      }
      const schema = await provider.getToolSchema(toolSlug);
      if (!schema) {
        throw new HTTPException(404, { message: `Schema for tool ${toolSlug} not found in provider ${providerId}` });
      }
      return schema;
    } catch (error) {
      return handleError(error, 'Error getting tool provider tool schema');
    }
  },
});

/**
 * POST /tool-providers/:providerId/authorize — Start an OAuth flow and persist
 * a `tool_provider_connections` row for label / scope joins.
 */
export const AUTHORIZE_TOOL_PROVIDER_ROUTE = createRoute({
  method: 'POST',
  path: '/tool-providers/:providerId/authorize',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  bodySchema: authorizeToolProviderBodySchema,
  responseSchema: authorizeToolProviderResponseSchema,
  summary: 'Authorize tool provider connection',
  description: 'Starts an OAuth flow and returns a redirect URL + opaque auth handle',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolkit, connectionId, toolName, config, label, scope, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.authorize) {
        throw new HTTPException(400, { message: `Tool provider ${providerId} does not support authorize` });
      }
      // Per-pin scope:
      // - 'shared' buckets under SHARED_BUCKET_ID.
      // - 'caller-supplied' buckets under request-context resourceId (400 if missing).
      // - 'per-author' (default) buckets under the caller's resolved authorId.
      const effectiveScope: 'shared' | 'per-author' | 'caller-supplied' =
        scope === 'shared' || scope === 'caller-supplied' ? scope : 'per-author';
      const callerResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
      if (effectiveScope === 'caller-supplied') {
        if (typeof callerResourceId !== 'string' || callerResourceId.length === 0) {
          throw new HTTPException(400, {
            message: `Cannot authorize caller-supplied connection: request context has no '${MASTRA_RESOURCE_ID_KEY}'. Set requestContext.set('${MASTRA_RESOURCE_ID_KEY}', <userId>) before calling /authorize.`,
          });
        }
      }
      const callerAuthorId = resolveOwnerId(requestContext, mastra.getLogger());
      const ownerAuthorId =
        effectiveScope === 'shared'
          ? SHARED_BUCKET_ID
          : effectiveScope === 'caller-supplied'
            ? (callerResourceId as string)
            : callerAuthorId;

      // Fresh connect (no connectionId) uses the resolved owner id as the
      // provider bucket so the adapter creates the connection under the same
      // userId the runtime will resolve to at execution time. Re-auth (caller
      // passed an existing connectionId) is left untouched.
      const bucket = connectionId && connectionId.length > 0 ? connectionId : ownerAuthorId;
      const result = await provider.authorize({ toolkit, connectionId: bucket, toolName, config });

      // Persist label + scope. Upsert even when label is null/undefined so the
      // row exists for later list-join in the picker.
      const persistedConnectionId = connectionId && connectionId.length > 0 ? connectionId : result.authId;
      try {
        const storage = mastra.getStorage();
        const store = await storage?.getStore('toolProviderConnections');
        if (store && persistedConnectionId) {
          await store.upsertConnection({
            authorId: ownerAuthorId,
            providerId: provider.info.id,
            toolkit,
            connectionId: persistedConnectionId,
            label: typeof label === 'string' && label.length > 0 ? label : null,
            scope: effectiveScope,
          });
        }
      } catch (upsertError) {
        mastra.getLogger?.()?.warn?.('[tool-providers] failed to upsert tool_provider_connections label', {
          error: upsertError instanceof Error ? upsertError.message : String(upsertError),
          providerId,
          toolkit,
          connectionId: persistedConnectionId,
        });
      }

      return result;
    } catch (error) {
      return handleError(error, 'Error authorizing tool provider');
    }
  },
});

/**
 * GET /tool-providers/:providerId/auth-status/:authId — Poll OAuth flow status.
 */
export const GET_TOOL_PROVIDER_AUTH_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/auth-status/:authId',
  responseType: 'json',
  pathParamSchema: toolProviderAuthStatusPathParams,
  responseSchema: authStatusToolProviderResponseSchema,
  summary: 'Get tool provider auth status',
  description: 'Polls the OAuth flow status for an outstanding authorize call',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, authId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.getAuthStatus) {
        throw new HTTPException(400, { message: `Tool provider ${providerId} does not support getAuthStatus` });
      }
      const status = await provider.getAuthStatus(authId);
      return { status };
    } catch (error) {
      return handleError(error, 'Error getting tool provider auth status');
    }
  },
});

/**
 * POST /tool-providers/:providerId/connection-status — Batch-check connection liveness.
 */
export const TOOL_PROVIDER_CONNECTION_STATUS_ROUTE = createRoute({
  method: 'POST',
  path: '/tool-providers/:providerId/connection-status',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  bodySchema: connectionStatusToolProviderBodySchema,
  responseSchema: connectionStatusToolProviderResponseSchema,
  summary: 'Get connection status for a provider',
  description: 'Batch-checks whether a set of (connectionId, toolkit) tuples are still connected',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, items }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.getConnectionStatus) {
        throw new HTTPException(400, { message: `Tool provider ${providerId} does not support getConnectionStatus` });
      }
      const result = await provider.getConnectionStatus({ items });
      return { items: result };
    } catch (error) {
      return handleError(error, 'Error getting connection status');
    }
  },
});

/**
 * GET /tool-providers/:providerId/connections — Existing provider connections
 * scoped to a toolkit. Admin callers can pass `authorId` and `scope` filters;
 * non-admins always see only their own + shared rows.
 */
export const LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/connections',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  queryParamSchema: listConnectionsQuerySchema,
  responseSchema: listConnectionsResponseSchema,
  summary: 'List existing connections',
  description:
    'Returns existing provider connections on a toolkit, so the picker can offer them for pinning without re-running OAuth',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({
    mastra,
    providerId,
    toolkit,
    authorId: queryAuthorId,
    scope: queryScope,
    page,
    perPage,
    requestContext,
  }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.listConnections) {
        throw new HTTPException(400, { message: `Tool provider ${providerId} does not support listConnections` });
      }
      const callerAuthorId = resolveOwnerId(requestContext, mastra.getLogger());
      const isAdmin = requestContext ? hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE) : false;

      const requestedAuthorId =
        isAdmin && typeof queryAuthorId === 'string' && queryAuthorId.length > 0 ? queryAuthorId : undefined;
      const effectiveAuthorId = isAdmin ? requestedAuthorId : callerAuthorId;

      const storage = mastra.getStorage();
      const store = await storage?.getStore('toolProviderConnections');

      // Strategy B: seed userIds[] from persisted rows so admins can enumerate
      // connections owned by other authors.
      let labelRows: Array<{
        authorId: string;
        connectionId: string;
        label: string | null;
        scope: 'shared' | 'per-author' | 'caller-supplied';
      }> = [];
      if (store) {
        try {
          const rows = await store.listConnectionsByAuthor({
            providerId: provider.info.id,
            toolkit,
          });
          labelRows = rows.map(r => ({
            authorId: r.authorId,
            connectionId: r.connectionId,
            label: r.label,
            scope: r.scope ?? 'per-author',
          }));
        } catch (joinError) {
          mastra.getLogger?.()?.warn?.('[tool-providers] failed to join tool_provider_connections labels', {
            error: joinError instanceof Error ? joinError.message : String(joinError),
            providerId,
            toolkit,
          });
        }
      }

      const userIdSet = new Set<string>();
      const wantShared = !queryScope || queryScope === 'shared';
      const wantPerAuthor = !queryScope || queryScope === 'per-author';
      const wantCallerSupplied = !queryScope || queryScope === 'caller-supplied';
      const hasSharedRow = labelRows.some(r => r.scope === 'shared');
      if (isAdmin && effectiveAuthorId === undefined) {
        for (const r of labelRows) {
          if (r.scope === 'shared' && wantShared) userIdSet.add(r.authorId);
          if (r.scope === 'per-author' && wantPerAuthor) userIdSet.add(r.authorId);
          if (r.scope === 'caller-supplied' && wantCallerSupplied) userIdSet.add(r.authorId);
        }
      } else if (isAdmin && effectiveAuthorId) {
        if (wantPerAuthor || wantCallerSupplied) userIdSet.add(effectiveAuthorId);
        if (wantShared && hasSharedRow) userIdSet.add(SHARED_BUCKET_ID);
      } else {
        if (wantPerAuthor) userIdSet.add(callerAuthorId);
        if (wantShared && hasSharedRow) userIdSet.add(SHARED_BUCKET_ID);
        // Non-admins never enumerate caller-supplied connections.
      }

      const userIds = Array.from(userIdSet);
      if (userIds.length === 0) {
        return {
          items: [],
          pagination: { page: page ?? 1, perPage, hasMore: false },
        };
      }

      const adapterResult = await provider.listConnections({
        toolkit,
        userIds,
        ...(typeof page === 'number' ? { page } : {}),
        ...(typeof perPage === 'number' ? { perPage } : {}),
      });

      const rowByConnId = new Map(labelRows.map(r => [r.connectionId, r]));

      const visibleItems = adapterResult.items.filter(item => {
        if (!queryScope) return true;
        const scope = rowByConnId.get(item.connectionId)?.scope ?? 'per-author';
        return scope === queryScope;
      });

      return {
        items: visibleItems.map(item => {
          const row = rowByConnId.get(item.connectionId);
          return {
            ...item,
            label: row?.label ?? null,
            ...(row?.scope ? { scope: row.scope } : {}),
          };
        }),
        pagination: adapterResult.pagination,
      };
    } catch (error) {
      return handleError(error, 'Error listing tool provider connections');
    }
  },
});

/**
 * GET /tool-providers/:providerId/connection-fields — Dynamic auth fields
 * the picker should collect before authorize (e.g. Confluence subdomain).
 */
export const LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/connection-fields',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  queryParamSchema: listConnectionFieldsQuerySchema,
  responseSchema: listConnectionFieldsResponseSchema,
  summary: 'List connection field schema',
  description: 'Returns a list of provider-specific fields the UI should collect before initiating an authorize call',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolkit }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.listConnectionFields) {
        return { fields: [] };
      }
      const fields = await provider.listConnectionFields({ toolkit });
      return { fields };
    } catch (error) {
      return handleError(error, 'Error listing tool provider connection fields');
    }
  },
});

/**
 * DELETE /tool-providers/:providerId/connections/:connectionId — Disconnect.
 * Without `?force=true` rejects when the connection is still pinned by any
 * agent. With `?force=true` revokes at the provider (best-effort) and drops
 * the persisted row.
 */
export const DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/tool-providers/:providerId/connections/:connectionId',
  responseType: 'json',
  pathParamSchema: toolProviderConnectionPathParams,
  queryParamSchema: disconnectConnectionQuerySchema,
  responseSchema: disconnectConnectionResponseSchema,
  summary: 'Disconnect a connection',
  description:
    'Revokes the provider-side connection (if supported) and removes the persisted tool_provider_connections row. Use `?force=true` to bypass usage checks.',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, connectionId, force, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      const callerAuthorId = resolveOwnerId(requestContext, mastra.getLogger());
      const isAdmin = requestContext ? hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE) : false;
      const isForce = force === true || force === 'true';

      const storage = mastra.getStorage();
      const store = await storage?.getStore('toolProviderConnections');

      let ownerAuthorId: string | undefined;
      let ownerScope: 'shared' | 'per-author' | 'caller-supplied' | undefined;
      let matched = false;
      if (store) {
        const rows = await store.listConnectionsByAuthor({ providerId: provider.info.id });
        const match = rows.find(r => r.connectionId === connectionId);
        if (match) {
          matched = true;
          ownerAuthorId = match.authorId;
          ownerScope = match.scope;
        }
      }

      // Fail closed: if storage is configured and no row matches the
      // requested connectionId, refuse the call for non-admins. Without
      // this guard, a caller could trigger provider-side `revokeConnection`
      // against another tenant's connectionId by guessing it.
      if (store && !matched && !isAdmin) {
        throw new HTTPException(403, {
          message: 'You do not have permission to disconnect this connection',
        });
      }

      const effectiveOwner = ownerAuthorId ?? callerAuthorId;
      const isShared = ownerScope === 'shared';
      if (!isShared && effectiveOwner !== callerAuthorId && !isAdmin) {
        throw new HTTPException(403, {
          message: 'You do not have permission to disconnect this connection',
        });
      }

      if (!isForce) {
        const usage = await countConnectionUsage(mastra, connectionId);
        if (usage > 0) {
          throw new HTTPException(409, {
            message: `Connection ${connectionId} is still pinned by ${usage} agent(s). Pass ?force=true to disconnect anyway.`,
          });
        }
      }

      let revoked = false;
      if (provider.capabilities?.supportsRevoke && typeof provider.revokeConnection === 'function') {
        await provider.revokeConnection(connectionId);
        revoked = true;
      }

      if (store) {
        await store.deleteConnection({
          authorId: effectiveOwner,
          providerId: provider.info.id,
          connectionId,
        });
      }

      return { ok: true as const, revoked };
    } catch (error) {
      return handleError(error, 'Error disconnecting tool provider connection');
    }
  },
});

/**
 * PATCH /tool-providers/:providerId/connections/:connectionId — Update a
 * connection's persisted display label. Idempotent. Ownership-gated the same
 * way as DISCONNECT: only the connection owner (or an admin) may rename,
 * unless the row is `scope: 'shared'`.
 *
 * Pass `label: null` (or an empty string) to clear the existing label.
 */
export const UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE = createRoute({
  method: 'PATCH',
  path: '/tool-providers/:providerId/connections/:connectionId',
  responseType: 'json',
  pathParamSchema: toolProviderConnectionPathParams,
  bodySchema: updateConnectionBodySchema,
  responseSchema: updateConnectionResponseSchema,
  summary: 'Update a connection label',
  description:
    'Updates the persisted display label on tool_provider_connections. Returns 403 when caller is neither the owner nor admin (and the row is not shared), 404 when the row does not exist.',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, connectionId, label, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      const callerAuthorId = resolveOwnerId(requestContext, mastra.getLogger());
      const isAdmin = requestContext ? hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE) : false;

      const storage = mastra.getStorage();
      const store = await storage?.getStore('toolProviderConnections');
      if (!store) {
        throw new HTTPException(500, {
          message: 'Tool provider connections storage is not configured',
        });
      }

      const rows = await store.listConnectionsByAuthor({ providerId: provider.info.id });
      const match = rows.find(r => r.connectionId === connectionId);
      if (!match) {
        throw new HTTPException(404, {
          message: `Connection ${connectionId} not found for provider ${providerId}`,
        });
      }

      const isShared = match.scope === 'shared';
      if (!isShared && match.authorId !== callerAuthorId && !isAdmin) {
        throw new HTTPException(403, {
          message: 'You do not have permission to update this connection',
        });
      }

      // Normalize: empty string and explicit null both clear the label.
      const nextLabel: string | null = typeof label === 'string' && label.trim().length > 0 ? label.trim() : null;

      await store.upsertConnection({
        authorId: match.authorId,
        providerId: provider.info.id,
        toolkit: match.toolkit,
        connectionId,
        label: nextLabel,
        scope: match.scope,
      });

      return { ok: true as const, label: nextLabel };
    } catch (error) {
      return handleError(error, 'Error updating tool provider connection');
    }
  },
});

/**
 * GET /tool-providers/:providerId/connections/:connectionId/usage — Lists agents
 * that currently pin the given connection in their `toolProviders` config.
 */
export const GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/connections/:connectionId/usage',
  responseType: 'json',
  pathParamSchema: toolProviderConnectionPathParams,
  queryParamSchema: connectionUsageQuerySchema,
  responseSchema: connectionUsageResponseSchema,
  summary: 'List agents using a connection',
  description: 'Returns the agents that pin this connection in their toolProviders config',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, connectionId, toolkit, requestContext }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      const callerAuthorId = resolveOwnerId(requestContext, mastra.getLogger());
      const isAdmin = requestContext ? hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE) : false;

      const storage = mastra.getStorage();
      const store = await storage?.getStore('toolProviderConnections');
      let ownerAuthorId: string | undefined;
      let ownerScope: 'shared' | 'per-author' | 'caller-supplied' | undefined;
      let matched = false;
      if (store) {
        const rows = await store.listConnectionsByAuthor({ providerId: provider.info.id });
        const match = rows.find(r => r.connectionId === connectionId);
        if (match) {
          matched = true;
          ownerAuthorId = match.authorId;
          ownerScope = match.scope;
        }
      }

      // Fail closed: if storage is configured and no row matches the
      // requested connectionId, refuse the call for non-admins so callers
      // cannot probe for other tenants' connections.
      if (store && !matched && !isAdmin) {
        throw new HTTPException(403, {
          message: 'You do not have permission to view usage for this connection',
        });
      }

      const effectiveOwner = ownerAuthorId ?? callerAuthorId;
      const isShared = ownerScope === 'shared';
      if (!isShared && effectiveOwner !== callerAuthorId && !isAdmin) {
        throw new HTTPException(403, {
          message: 'You do not have permission to view usage for this connection',
        });
      }

      const agents = await scanConnectionUsage(mastra, { providerId: provider.info.id, connectionId, toolkit });
      return { agents };
    } catch (error) {
      return handleError(error, 'Error listing tool provider connection usage');
    }
  },
});

/**
 * GET /tool-providers/:providerId/health — Provider-level health check.
 */
export const GET_TOOL_PROVIDER_HEALTH_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/health',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  responseSchema: toolProviderHealthResponseSchema,
  summary: 'Get tool provider health',
  description: 'Returns provider-level health (config, reachability, etc.)',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId }) => {
    try {
      const editor = requireEditor(mastra.getEditor());
      const provider = await resolveProvider(editor, providerId);
      if (!provider.getHealth) {
        return { ok: true };
      }
      return await provider.getHealth();
    } catch (error) {
      return handleError(error, 'Error getting tool provider health');
    }
  },
});

// ============================================================================
// Usage scan helpers
// ============================================================================

async function scanConnectionUsage(
  mastra: any,
  args: { providerId: string; connectionId: string; toolkit?: string },
): Promise<Array<{ id: string; name: string }>> {
  const storage = mastra.getStorage();
  const agentsStore = await storage?.getStore('agents');
  if (!agentsStore) return [];

  const { agents } = await agentsStore.listResolved({ perPage: false });
  const out: Array<{ id: string; name: string }> = [];
  for (const agent of agents) {
    const config = agent?.toolProviders?.[args.providerId];
    if (!config?.connections) continue;
    for (const [toolkit, connections] of Object.entries(config.connections)) {
      if (args.toolkit && toolkit !== args.toolkit) continue;
      const match = (connections as Array<{ connectionId: string }>).some(c => c.connectionId === args.connectionId);
      if (match) {
        out.push({ id: agent.id, name: agent.name ?? agent.id });
        break;
      }
    }
  }
  return out;
}

async function countConnectionUsage(mastra: any, connectionId: string): Promise<number> {
  const storage = mastra.getStorage();
  const agentsStore = await storage?.getStore('agents');
  if (!agentsStore) return 0;
  const { agents } = await agentsStore.listResolved({ perPage: false });
  let count = 0;
  for (const agent of agents) {
    const tp = agent?.toolProviders;
    if (!tp) continue;
    for (const config of Object.values(tp) as Array<{
      connections?: Record<string, Array<{ connectionId: string }>>;
    }>) {
      const pinned = Object.values(config?.connections ?? {}).some(arr =>
        arr.some(c => c.connectionId === connectionId),
      );
      if (pinned) {
        count += 1;
        break;
      }
    }
  }
  return count;
}
