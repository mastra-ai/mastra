/**
 * Factory-owned HTTP routes for integration identity claims and candidate
 * discovery. Every route mounts on `/web/identity/*`, uses the shared
 * `RouteAuth` seam, and returns tenant errors uniformly (`401` unsigned,
 * `403` when the caller has no org). Claims and candidates are always
 * scoped by the request's `orgId`, never by any client-supplied value —
 * this is how cross-org bleed is prevented.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { IdentityService } from '../services/identity-service.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

/**
 * Maximum length for a claim's display metadata. The label/email are
 * user-controllable via the settings UI (label is the provider-reported
 * name), so a byte cap keeps a runaway upstream from writing megabytes of
 * text into the claim table.
 */
const MAX_LABEL_LENGTH = 512;
const MAX_EMAIL_LENGTH = 320;
const MAX_EXTERNAL_USER_ID_LENGTH = 512;
const MAX_INTEGRATION_ID_LENGTH = 128;
const MAX_QUERY_LENGTH = 200;

const CONTROL_CHAR_RE = /[\0-\x08\x0b\x0c\x0e-\x1f\x7f]/;

function loose(context: unknown): Context {
  return context as Context;
}

async function readJson(context: Context): Promise<unknown | undefined> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

/**
 * Reject `undefined`/non-string/empty-after-trim/too-long/control-char cases
 * up front so bogus writes never touch the storage layer. Returns the
 * normalized string on success and `null` on failure so callers can convert
 * to a single `400 invalid_body` response.
 */
function parseRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;
  if (CONTROL_CHAR_RE.test(trimmed)) return null;
  return trimmed;
}

function parseOptionalString(value: unknown, maxLength: number): string | undefined | false {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) return false;
  if (CONTROL_CHAR_RE.test(trimmed)) return false;
  return trimmed;
}

export interface IdentityRoutesDeps extends RouteDependencies {
  service: IdentityService;
}

export class IdentityRoutes extends Route<IdentityRoutesDeps> {
  async #resolveTenant(context: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.deps.auth.ensureUser(context);
    const tenant = this.deps.auth.tenant(context);
    if (!tenant) return { response: context.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: context.json(
          { error: 'organization_required', message: 'Identity claims require an organization.' },
          403,
        ),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  routes(): ApiRoute[] {
    return [
      /**
       * List every identity-capable integration registered on the factory.
       * Powers the settings UI's per-integration expander list; the UI needs
       * this before it can call `/web/identity/candidates/:integrationId`.
       */
      registerApiRoute('/web/identity/integrations', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          return context.json({ integrations: this.deps.service.listIdentityIntegrations() });
        },
      }),
      /**
       * All claims the acting user has made in the current org, across every
       * integration. Returned in the storage-native shape so the UI can
       * cross-reference against candidate lists by `(integrationId,
       * externalUserId)`.
       */
      registerApiRoute('/web/identity/claims', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const claims = await this.deps.service.listMyClaims(tenant.orgId, tenant.userId);
          return context.json({ claims });
        },
      }),
      /**
       * Candidate accounts for a single integration, optionally text-filtered
       * server-side. Unknown/absent integrations return an empty list rather
       * than 404 so the UI can render an empty state without special-casing
       * missing integrations.
       */
      /**
       * Merged candidate feed across every identity-capable integration —
       * powers the single-dropdown UI in Settings. Each row is tagged with
       * its `integrationId`.
       */
      registerApiRoute('/web/identity/candidates', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const rawQuery = context.req.query('query');
          const query = parseOptionalString(rawQuery, MAX_QUERY_LENGTH);
          if (query === false) return context.json({ error: 'invalid_query' }, 400);
          const candidates = await this.deps.service.listAllCandidates(tenant.orgId, query);
          return context.json({ candidates });
        },
      }),
      registerApiRoute('/web/identity/candidates/:integrationId', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const integrationId = parseRequiredString(context.req.param('integrationId'), MAX_INTEGRATION_ID_LENGTH);
          if (!integrationId) return context.json({ error: 'invalid_integration_id' }, 400);
          const rawQuery = context.req.query('query');
          const query = parseOptionalString(rawQuery, MAX_QUERY_LENGTH);
          if (query === false) return context.json({ error: 'invalid_query' }, 400);
          const candidates = await this.deps.service.listCandidates(tenant.orgId, integrationId, query);
          return context.json({ candidates });
        },
      }),
      /**
       * Claim an external account. Idempotent by `(integrationId,
       * externalUserId)` — replaying with the same key refreshes the
       * display metadata and returns `200`; a first-time claim returns
       * `201`. The client distinguishes the two only when it wants to
       * animate a fresh insertion.
       */
      registerApiRoute('/web/identity/claims', {
        method: 'POST',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const body = await readJson(context);
          if (!body || typeof body !== 'object') return context.json({ error: 'invalid_body' }, 400);
          const input = body as Record<string, unknown>;
          const integrationId = parseRequiredString(input.integrationId, MAX_INTEGRATION_ID_LENGTH);
          const externalUserId = parseRequiredString(input.externalUserId, MAX_EXTERNAL_USER_ID_LENGTH);
          const label = parseRequiredString(input.label, MAX_LABEL_LENGTH);
          const email = parseOptionalString(input.email, MAX_EMAIL_LENGTH);
          if (!integrationId || !externalUserId || !label || email === false) {
            return context.json({ error: 'invalid_body' }, 400);
          }
          // Refuse claims against integrations that don't advertise the
          // identity capability. Prevents an authenticated tenant from
          // writing thousands of dangling claim rows against arbitrary
          // provider ids that no consumer would ever surface.
          const known = this.deps.service.listIdentityIntegrations();
          if (!known.some(descriptor => descriptor.id === integrationId)) {
            return context.json({ error: 'unknown_integration' }, 400);
          }
          const existing = await this.deps.service.listMyClaims(tenant.orgId, tenant.userId);
          const wasPresent = existing.some(
            claim => claim.integrationId === integrationId && claim.externalUserId === externalUserId,
          );
          const claim = await this.deps.service.claim({
            orgId: tenant.orgId,
            userId: tenant.userId,
            integrationId,
            externalUserId,
            label,
            ...(email !== undefined ? { email } : {}),
          });
          return context.json({ claim }, wasPresent ? 200 : 201);
        },
      }),
      /**
       * Delete a claim. Always returns `204`, whether or not the row
       * existed, so the client can call it as a fire-and-forget after
       * unchecking a candidate.
       */
      registerApiRoute('/web/identity/claims/:integrationId/:externalUserId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const integrationId = parseRequiredString(context.req.param('integrationId'), MAX_INTEGRATION_ID_LENGTH);
          const externalUserId = parseRequiredString(context.req.param('externalUserId'), MAX_EXTERNAL_USER_ID_LENGTH);
          if (!integrationId || !externalUserId) return context.json({ error: 'invalid_path' }, 400);
          await this.deps.service.unclaim({
            orgId: tenant.orgId,
            userId: tenant.userId,
            integrationId,
            externalUserId,
          });
          return context.body(null, 204);
        },
      }),
    ];
  }
}
