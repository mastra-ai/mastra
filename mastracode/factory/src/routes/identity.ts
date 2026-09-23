/**
 * Factory-owned HTTP surface for cross-integration user identity: one
 * endpoint (`/web/identity`) that lists every provider-known account across
 * every identity-capable integration, plus write ops for the acting user's
 * claims. Claims and identities are always scoped by the request's `orgId`,
 * never by any client-supplied value — this is how cross-org bleed is
 * prevented.
 *
 * - `GET  /web/identity` — merged provider member list across every
 *   identity-capable integration. Each row is tagged with its
 *   `integrationId`, a per-integration `installation` label (e.g. GitHub
 *   org slug, Linear workspace url-key) so a user with three "alice"
 *   accounts can tell them apart, and `claimed: boolean` reflecting the
 *   acting user's current claim state.
 * - `POST /web/identity` — assert a claim on one `(integrationId,
 *   externalUserId)` pair. Idempotent by key; first-time claim returns
 *   `201`, replay returns `200`. Rejects unknown integrations up front so
 *   dangling rows never enter storage.
 * - `DELETE /web/identity` — remove a claim, keyed by `integrationId` +
 *   `externalUserId` query params. Always returns `204`.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { IdentityService } from '../services/identity-service.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

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
       * Merged provider-member feed across every identity-capable
       * integration. Each row already carries the acting user's `claimed`
       * state, so the UI's single dropdown never needs a second call to
       * cross-reference claims against candidates.
       */
      registerApiRoute('/web/identity', {
        method: 'GET',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const rawQuery = context.req.query('query');
          const query = parseOptionalString(rawQuery, MAX_QUERY_LENGTH);
          if (query === false) return context.json({ error: 'invalid_query' }, 400);
          const [identities, integrations] = await Promise.all([
            this.deps.service.listIdentities(tenant.orgId, tenant.userId, query),
            Promise.resolve(this.deps.service.listIdentityIntegrations()),
          ]);
          return context.json({ integrations, identities });
        },
      }),
      /**
       * Claim an external account. Body: `{ integrationId, externalUserId,
       * label, email? }`. Idempotent by key.
       */
      registerApiRoute('/web/identity', {
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
       * Unclaim an external account. Uses query params so the URL is
       * portable and re-issuable: `DELETE
       * /web/identity?integrationId=X&externalUserId=Y`. Always `204`,
       * whether or not the row existed.
       */
      registerApiRoute('/web/identity', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async routeContext => {
          const context = loose(routeContext);
          const tenant = await this.#resolveTenant(context);
          if ('response' in tenant) return tenant.response;
          const integrationId = parseRequiredString(context.req.query('integrationId'), MAX_INTEGRATION_ID_LENGTH);
          const externalUserId = parseRequiredString(context.req.query('externalUserId'), MAX_EXTERNAL_USER_ID_LENGTH);
          if (!integrationId || !externalUserId) return context.json({ error: 'invalid_query' }, 400);
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
