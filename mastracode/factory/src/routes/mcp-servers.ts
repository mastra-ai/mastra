import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { z } from 'zod';

import type { McpServersRuntime } from '../mcp-servers/runtime.js';
import { createMcpServerSchemas, MCP_SERVER_LIMITS, slugify } from '../mcp-servers/schemas.js';
import { McpServerInputError, McpServerSlugConflictError } from '../storage/domains/mcp-servers/base.js';
import type {
  McpServerAuthType,
  McpServerRecord,
  McpServersStorage,
  McpServerStatus,
} from '../storage/domains/mcp-servers/base.js';
import { tenantOrgId } from './provider-credentials.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

export interface McpServerRoutesDeps extends RouteDependencies {
  /** Absent when the app database is not configured. */
  storage?: McpServersStorage;
  runtime: McpServersRuntime;
  /** Accept servers on loopback/private addresses (local development, opt-in deployments). */
  allowPrivateNetwork: boolean;
  /** Public origin of the Factory; the OAuth Client ID Metadata Document needs it to be https. */
  publicOrigin: string;
}

export interface McpServerToolInfo {
  name: string;
  /** Name the agent and permission rules see. */
  exposedName: string;
  title?: string;
  description?: string;
  selected: boolean;
  /** Appeared on a refresh and was not reviewed yet; never selected automatically. */
  isNew: boolean;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/** A server as the settings UI sees it. Secrets are never included: only header names and whether a client secret is saved. */
export interface McpServerInfo {
  id: string;
  name: string;
  slug: string;
  url: string;
  authType: McpServerAuthType;
  headerNames: string[];
  oauth?: { clientId: string | null; hasClientSecret: boolean; scopes: string[]; connected: boolean };
  status: McpServerStatus;
  lastError: string | null;
  discoveredAt: string | null;
  tools: McpServerToolInfo[];
}

interface McpServersContext {
  storage: McpServersStorage;
  orgId: string;
  userId: string;
  /** False in no-auth mode, where the single local user manages everything. */
  tenantMode: boolean;
}

const idSchema = z.uuid();

/** Widen a route-local Hono context to the plain `Context` the auth helpers take. */
function loose(c: unknown): Context {
  return c as Context;
}

function pickAnnotations(annotations: Record<string, unknown> | undefined): McpServerToolInfo['annotations'] {
  if (!annotations) return undefined;
  const picked: NonNullable<McpServerToolInfo['annotations']> = {};
  for (const key of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
    if (typeof annotations[key] === 'boolean') picked[key] = annotations[key];
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

async function toMcpServerInfo(storage: McpServersStorage, record: McpServerRecord): Promise<McpServerInfo> {
  const selected = new Set(record.selectedTools);
  const isNew = new Set(record.newTools);
  const tools = Object.entries(record.toolCatalog ?? {})
    .map(([name, { exposedName, definition }]): McpServerToolInfo => {
      const title = definition.title ?? definition.annotations?.title;
      const annotations = pickAnnotations(definition.annotations as Record<string, unknown> | undefined);
      return {
        name,
        exposedName,
        ...(title ? { title } : {}),
        ...(definition.description ? { description: definition.description } : {}),
        selected: selected.has(name),
        isNew: isNew.has(name),
        ...(annotations ? { annotations } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    url: record.url,
    authType: record.authType,
    headerNames: record.authType === 'headers' ? Object.keys(record.headers ?? {}) : [],
    ...(record.authType === 'oauth'
      ? {
          oauth: {
            clientId: record.oauthClientId,
            hasClientSecret: Boolean(record.oauthClientSecret),
            scopes: record.oauthScopes,
            connected: await storage.hasOAuthTokens(record.id),
          },
        }
      : {}),
    status: record.status,
    lastError: record.lastError,
    discoveredAt: record.discoveredAt?.toISOString() ?? null,
    tools,
  };
}

function invalidBody(c: Context, error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.length ? issue.path.join('.') : undefined;
  return c.json(
    { error: 'invalid_mcp_server', message: issue?.message ?? 'Invalid request.', ...(field ? { field } : {}) },
    400,
  );
}

function notFound(c: Context) {
  return c.json({ error: 'mcp_server_not_found', message: 'MCP server not found.' }, 404);
}

async function readJson(c: Context): Promise<{ body: unknown } | { response: Response }> {
  try {
    return { body: await c.req.json() };
  } catch {
    return { response: c.json({ error: 'invalid_mcp_server', message: 'Invalid JSON body.' }, 400) };
  }
}

/**
 * Organization MCP server settings:
 *   - `GET    /web/config/mcp-servers`             — list the organization's servers (any member)
 *   - `POST   /web/config/mcp-servers`             — add a server (admin)
 *   - `PATCH  /web/config/mcp-servers/:id`         — edit a server (admin)
 *   - `DELETE /web/config/mcp-servers/:id`         — remove a server (admin)
 *   - `POST   /web/config/mcp-servers/:id/discover` — connect and list the server's tools (admin)
 *   - `PUT    /web/config/mcp-servers/:id/tools`    — choose the tools sessions get (admin)
 *
 * Servers belong to the caller's organization (a sentinel `local` org in
 * no-auth mode); a server in another organization is a 404.
 */
export class McpServerRoutes extends Route<McpServerRoutesDeps> {
  routes(): ApiRoute[] {
    const { runtime, allowPrivateNetwork, publicOrigin } = this.deps;
    const schemas = createMcpServerSchemas({ allowPrivateNetwork });
    const metadataDocument = new URL(publicOrigin).protocol === 'https:';

    const handle =
      (
        access: 'member' | 'admin',
        run: (c: Context, ctx: McpServersContext) => Promise<Response>,
      ): ((c: unknown) => Promise<Response>) =>
      async raw => {
        const c = loose(raw);
        const ctx = await this.#context(c);
        if (ctx instanceof Response) return ctx;
        if (access === 'admin' && !(await this.#canManage(c, ctx))) {
          return c.json(
            { error: 'organization_admin_required', message: 'Only organization admins can manage MCP servers.' },
            403,
          );
        }
        try {
          return await run(c, ctx);
        } catch (error) {
          if (error instanceof McpServerInputError) {
            return c.json({ error: 'invalid_mcp_server', message: error.message }, 400);
          }
          console.error(`[factory] MCP server route failed: ${error instanceof Error ? error.message : String(error)}`);
          return c.json({ error: 'mcp_servers_failed', message: 'The MCP server request failed.' }, 500);
        }
      };

    const withServer =
      (run: (c: Context, ctx: McpServersContext, record: McpServerRecord) => Promise<Response>) =>
      async (c: Context, ctx: McpServersContext) => {
        const id = idSchema.safeParse(c.req.param('id'));
        if (!id.success) return notFound(c);
        const record = await ctx.storage.get({ orgId: ctx.orgId, id: id.data });
        return record ? run(c, ctx, record) : notFound(c);
      };

    return [
      registerApiRoute('/web/config/mcp-servers', {
        method: 'GET',
        requiresAuth: false,
        handler: handle('member', async (c, ctx) => {
          const records = await ctx.storage.list({ orgId: ctx.orgId });
          return c.json({
            servers: await Promise.all(records.map(record => toMcpServerInfo(ctx.storage, record))),
            canManage: await this.#canManage(c, ctx),
            oauth: { metadataDocument },
          });
        }),
      }),

      registerApiRoute('/web/config/mcp-servers', {
        method: 'POST',
        requiresAuth: false,
        handler: handle('admin', async (c, ctx) => {
          const json = await readJson(c);
          if ('response' in json) return json.response;
          const parsed = schemas.create.safeParse(json.body);
          if (!parsed.success) return invalidBody(c, parsed.error);
          if ((await ctx.storage.countForOrg({ orgId: ctx.orgId })) >= MCP_SERVER_LIMITS.serversPerOrg) {
            return c.json(
              {
                error: 'mcp_server_limit',
                message: `An organization can have at most ${MCP_SERVER_LIMITS.serversPerOrg} MCP servers.`,
              },
              400,
            );
          }
          const { name, url, authType, headers, oauth } = parsed.data;
          try {
            const record = await ctx.storage.create({
              orgId: ctx.orgId,
              userId: ctx.userId,
              input: { slug: slugify(name), name, url, authType, headers, oauth },
            });
            return c.json({ server: await toMcpServerInfo(ctx.storage, record) }, 201);
          } catch (error) {
            if (error instanceof McpServerSlugConflictError) {
              return c.json({ error: 'mcp_server_exists', message: error.message }, 409);
            }
            throw error;
          }
        }),
      }),

      registerApiRoute('/web/config/mcp-servers/:id', {
        method: 'PATCH',
        requiresAuth: false,
        handler: handle(
          'admin',
          withServer(async (c, ctx, record) => {
            const json = await readJson(c);
            if ('response' in json) return json.response;
            const parsed = schemas.update.safeParse(json.body);
            if (!parsed.success) return invalidBody(c, parsed.error);
            const updated = await ctx.storage.update({
              orgId: ctx.orgId,
              id: record.id,
              userId: ctx.userId,
              input: parsed.data,
            });
            runtime.invalidate(record.id);
            if (!updated) return notFound(c);
            return c.json({ server: await toMcpServerInfo(ctx.storage, updated) });
          }),
        ),
      }),

      registerApiRoute('/web/config/mcp-servers/:id', {
        method: 'DELETE',
        requiresAuth: false,
        handler: handle(
          'admin',
          withServer(async (c, ctx, record) => {
            const deleted = await ctx.storage.delete({ orgId: ctx.orgId, id: record.id });
            runtime.invalidate(record.id);
            return deleted ? c.json({ ok: true }) : notFound(c);
          }),
        ),
      }),

      registerApiRoute('/web/config/mcp-servers/:id/discover', {
        method: 'POST',
        requiresAuth: false,
        handler: handle(
          'admin',
          withServer(async (c, ctx, record) => {
            const result = await runtime.discover(record);
            const updated =
              result.status === 'connected'
                ? await ctx.storage.saveDiscovery({
                    orgId: ctx.orgId,
                    id: record.id,
                    ifUrl: record.url,
                    tools: result.tools,
                  })
                : await ctx.storage.setStatus({
                    orgId: ctx.orgId,
                    id: record.id,
                    status: result.status,
                    lastError: result.error,
                    ifUrl: record.url,
                  });
            runtime.invalidate(record.id);
            if (updated) return c.json({ server: await toMcpServerInfo(ctx.storage, updated) });
            if (!(await ctx.storage.get({ orgId: ctx.orgId, id: record.id }))) return notFound(c);
            return c.json(
              {
                error: 'mcp_server_changed',
                message: "The server's address changed while connecting. Connect again.",
              },
              409,
            );
          }),
        ),
      }),

      registerApiRoute('/web/config/mcp-servers/:id/tools', {
        method: 'PUT',
        requiresAuth: false,
        handler: handle(
          'admin',
          withServer(async (c, ctx, record) => {
            const json = await readJson(c);
            if ('response' in json) return json.response;
            const parsed = schemas.selectTools.safeParse(json.body);
            if (!parsed.success) return invalidBody(c, parsed.error);
            const updated = await ctx.storage.setSelectedTools({
              orgId: ctx.orgId,
              id: record.id,
              userId: ctx.userId,
              selected: parsed.data.selected,
            });
            runtime.invalidate(record.id);
            if (!updated) return notFound(c);
            return c.json({ server: await toMcpServerInfo(ctx.storage, updated) });
          }),
        ),
      }),
    ];
  }

  /** Tenant rows in deployed mode, a sentinel `local` org in no-auth mode; 401/503 responses otherwise. */
  async #context(c: Context): Promise<McpServersContext | Response> {
    const { auth, storage } = this.deps;
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant && auth.enabled()) return c.json({ error: 'unauthorized' }, 401);
    try {
      if (!storage) throw new Error('MCP server storage is not configured');
      await storage.ensureReady();
    } catch {
      return c.json(
        {
          error: 'mcp_servers_unavailable',
          message: 'MCP server storage is unavailable — the app database is not configured or failed to start.',
        },
        503,
      );
    }
    return tenant
      ? { storage, orgId: tenantOrgId(tenant), userId: tenant.userId, tenantMode: true }
      : { storage, orgId: 'local', userId: 'local', tenantMode: false };
  }

  async #canManage(c: Context, ctx: McpServersContext): Promise<boolean> {
    return !ctx.tenantMode || (await this.deps.auth.isOrganizationAdmin(c, ctx.orgId));
  }
}
