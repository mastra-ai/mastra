/**
 * Provider account pool routes (Settings › Providers › Accounts).
 *
 * A pool is the ordered list of accounts (OAuth subscriptions and API keys)
 * held for one provider in one scope: the caller's own pool (`?scope=user`,
 * the default) or the org's shared pool (`?scope=org`, org admins only).
 * Requests use the active account; the rest are switched to in priority order.
 *
 * Every response is `{ accounts: PoolAccountSummary[] }` in pool order
 * (priority, then creation) and never carries token material. Local
 * (no-auth) mode serves the file-backed `AuthStorage` OAuth accounts and
 * ignores `scope`, as the other credential routes do.
 */

import type { PoolAccountSummary } from '@mastra/code-sdk/auth/account-registry';
import { sortByPriority } from '@mastra/code-sdk/auth/account-registry';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type {
  CredentialScope,
  CredentialTenant,
  ModelCredentialsStorage,
} from '../storage/domains/credentials/base.js';
import { getAuthProviderId, loose, resolveCredentialContext } from './provider-credentials.js';
import { Route } from './route.js';
import type { RouteDependencies } from './route.js';

export interface ProviderAccountRoutesDeps extends RouteDependencies {
  /** File-backed credential store; used in local (no-auth) mode. */
  authStorage?: AuthStorage;
  /** Tenant credential domain handle; absent in local (no-DB) mode. */
  modelCredentials?: ModelCredentialsStorage;
  /** Notifies the host after tenant credentials change so caches can be dropped. */
  onCredentialsChanged?: (tenant: { orgId: string; userId?: string }) => void;
}

/** One pool's operations, over tenant storage or the local `AuthStorage`. */
interface PoolHandle {
  list(): Promise<PoolAccountSummary[]>;
  activate(accountId: string): Promise<void>;
  rename(accountId: string, label: string): Promise<void>;
  remove(accountId: string): Promise<void>;
  reorder(orderedIds: string[]): Promise<void>;
  /** Called after every write. */
  changed(): void;
}

type PoolResolution = { pool: PoolHandle } | { response: Response };

function tenantPool(
  storage: ModelCredentialsStorage,
  tenant: CredentialTenant,
  providerId: string,
  onCredentialsChanged: (tenant: CredentialTenant) => void,
): PoolHandle {
  return {
    list: () => storage.listAccounts(tenant, providerId),
    activate: async id => void (await storage.activateAccount(tenant, id)),
    rename: async (id, label) => void (await storage.renameAccount(tenant, id, label)),
    remove: async id => void (await storage.removeAccount(tenant, id)),
    reorder: ids => storage.reorderAccounts(tenant, providerId, ids),
    changed: () => onCredentialsChanged(tenant),
  };
}

function localPool(authStorage: AuthStorage, providerId: string): PoolHandle {
  return {
    list: async () =>
      sortByPriority(authStorage.listAccounts(providerId)).map((record, index) => ({
        id: record.id,
        providerId,
        type: 'oauth',
        label: record.label,
        active: record.active,
        priority: record.priority ?? index,
        status: 'ok',
        createdAt: Date.parse(record.addedAt),
      })),
    activate: async id => void authStorage.activateAccount(providerId, id),
    rename: async (id, label) => authStorage.renameAccount(providerId, id, label),
    remove: async id => authStorage.removeAccount(providerId, id),
    reorder: async ids => authStorage.reorderAccounts(providerId, ids),
    changed: () => {},
  };
}

function parseScope(value: string | undefined): CredentialScope | undefined {
  if (value === undefined || value === '' || value === 'user') return 'user';
  if (value === 'org') return 'org';
  return undefined;
}

/**
 * Provider account pool routes as Mastra `apiRoutes` (all take `?scope=user|org`):
 *   - `GET    /web/config/providers/:provider/accounts`                     — list the pool
 *   - `POST   /web/config/providers/:provider/accounts/:accountId/activate` — make an account active
 *   - `PATCH  /web/config/providers/:provider/accounts/:accountId`          — rename (`{ label }`)
 *   - `DELETE /web/config/providers/:provider/accounts/:accountId`          — remove one account
 *   - `PUT    /web/config/providers/:provider/accounts/order`               — reorder (`{ orderedIds }`)
 */
export class ProviderAccountRoutes extends Route<ProviderAccountRoutesDeps> {
  routes(): ApiRoute[] {
    const { auth, authStorage, modelCredentials } = this.deps;
    const onCredentialsChanged = this.deps.onCredentialsChanged ?? (() => {});

    const resolvePool = async (c: Context): Promise<PoolResolution> => {
      const ctx = await resolveCredentialContext({ c, auth, credentials: modelCredentials });
      if ('response' in ctx) return ctx;
      const providerId = getAuthProviderId(c.req.param('provider') ?? '');
      const scope = parseScope(c.req.query('scope'));
      if (!scope) {
        return { response: c.json({ error: 'invalid_scope', message: 'scope must be "user" or "org"' }, 400) };
      }
      if (ctx.mode === 'local') {
        if (!authStorage) return { response: c.json({ error: 'Credential storage is not available' }, 503) };
        return { pool: localPool(authStorage, providerId) };
      }
      if (scope === 'org' && !(await auth.isOrganizationAdmin(c, ctx.orgId))) {
        return {
          response: c.json({ error: 'forbidden', message: "Only org admins can manage the org's accounts" }, 403),
        };
      }
      const tenant: CredentialTenant =
        scope === 'org' ? { orgId: ctx.orgId } : { orgId: ctx.orgId, userId: ctx.userId };
      return { pool: tenantPool(ctx.storage, tenant, providerId, onCredentialsChanged) };
    };

    /** Resolve the pool and check `:accountId` belongs to it, then apply `write`. */
    const accountWrite = async (
      c: Context,
      write: (pool: PoolHandle, accountId: string) => Promise<Response | void>,
    ): Promise<Response> => {
      const resolved = await resolvePool(c);
      if ('response' in resolved) return resolved.response;
      const { pool } = resolved;
      const accountId = c.req.param('accountId') ?? '';
      try {
        if (!(await pool.list()).some(account => account.id === accountId)) {
          return c.json({ error: 'account_not_found' }, 404);
        }
        const early = await write(pool, accountId);
        if (early) return early;
        pool.changed();
        return c.json({ accounts: await pool.list() });
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    };

    return [
      registerApiRoute('/web/config/providers/:provider/accounts', {
        method: 'GET',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolvePool(loose(c));
          if ('response' in resolved) return resolved.response;
          try {
            return c.json({ accounts: await resolved.pool.list() });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      // Registered before `:accountId` so the literal segment wins.
      registerApiRoute('/web/config/providers/:provider/accounts/order', {
        method: 'PUT',
        requiresAuth: false,
        handler: async c => {
          const resolved = await resolvePool(loose(c));
          if ('response' in resolved) return resolved.response;
          const { pool } = resolved;
          const body = await readJsonBody(loose(c));
          const orderedIds = body?.orderedIds;
          if (!Array.isArray(orderedIds) || !orderedIds.every(id => typeof id === 'string')) {
            return c.json({ error: 'invalid_input', message: 'orderedIds must be an array of account ids' }, 400);
          }
          if (new Set(orderedIds).size !== orderedIds.length) {
            return c.json({ error: 'invalid_input', message: 'orderedIds contains duplicate account ids' }, 400);
          }
          try {
            const known = new Set((await pool.list()).map(account => account.id));
            const unknown = orderedIds.filter(id => !known.has(id));
            if (unknown.length > 0) {
              return c.json({ error: 'invalid_input', message: `Unknown account ids: ${unknown.join(', ')}` }, 400);
            }
            await pool.reorder(orderedIds);
            pool.changed();
            return c.json({ accounts: await pool.list() });
          } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
          }
        },
      }),

      registerApiRoute('/web/config/providers/:provider/accounts/:accountId/activate', {
        method: 'POST',
        requiresAuth: false,
        handler: async c => accountWrite(loose(c), (pool, accountId) => pool.activate(accountId)),
      }),

      registerApiRoute('/web/config/providers/:provider/accounts/:accountId', {
        method: 'PATCH',
        requiresAuth: false,
        handler: async c => {
          const body = await readJsonBody(loose(c));
          const label = typeof body?.label === 'string' ? body.label.trim() : '';
          if (!label) return c.json({ error: 'invalid_input', message: 'label must be a non-empty string' }, 400);
          return accountWrite(loose(c), (pool, accountId) => pool.rename(accountId, label));
        },
      }),

      registerApiRoute('/web/config/providers/:provider/accounts/:accountId', {
        method: 'DELETE',
        requiresAuth: false,
        handler: async c => accountWrite(loose(c), (pool, accountId) => pool.remove(accountId)),
      }),
    ];
  }
}

async function readJsonBody(c: Context): Promise<Record<string, unknown> | undefined> {
  try {
    const body: unknown = await c.req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? Object.fromEntries(Object.entries(body)) : {};
  } catch {
    return undefined;
  }
}
