/**
 * Per-tenant Mastra controller dispatch for the multi-tenant web server.
 *
 * When web auth is enabled, every authenticated WorkOS user must operate against
 * their OWN Mastra instance bound to their OWN isolated libSQL storage/vector
 * pair (see `tenant-storage.ts`). A single shared Mastra/controller would land
 * all tenants' threads, messages, memory and recall vectors in one store — a
 * hard privacy violation.
 *
 * The Hono adapter binds a single fixed `Mastra` into request context at
 * construction time (`c.set('mastra', this.mastra)`), so outer middleware can't
 * retarget a shared controller per request. Instead, each tenant gets its own
 * fully isolated `MastraServer` adapter (its own Hono sub-app + Mastra +
 * storage). This dispatcher lazily builds and caches one per WorkOS user and
 * forwards `/api/*` requests to the right tenant app.
 *
 * Auth-disabled / local-dev keeps using the single shared adapter built by the
 * caller — this module is only engaged when `webAuthUser` is present.
 */

import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { Hono } from 'hono';
import type { Context } from 'hono';

import { mountAgentControllerOnMastra } from '../index.js';
import type { MastraCodeConfig } from '../index.js';

import { getWebAuthUser, getWebAuthUserId } from './auth.js';
import { getUserStorage } from './tenant-storage.js';

/** A fully isolated per-tenant controller stack. */
interface TenantApp {
  /** The tenant's Hono app with the Mastra surface mounted under `/api`. */
  fetch: (request: Request, ...rest: unknown[]) => Response | Promise<Response>;
  /** Stop the tenant's workers/heartbeats on eviction or shutdown. */
  stop: () => Promise<void>;
}

export interface TenantDispatcherOptions {
  /** Base controller config shared by every tenant (minus storage). */
  baseConfig: MastraCodeConfig;
  /** Controller id, matching the shared controller. */
  controllerId: string;
}

/**
 * Builds and caches per-tenant Mastra controller stacks and dispatches requests
 * to them based on the authenticated WorkOS user.
 */
export class TenantDispatcher {
  private readonly baseConfig: MastraCodeConfig;
  private readonly controllerId: string;
  /** tenantKey -> in-flight or resolved tenant app. */
  private readonly apps = new Map<string, Promise<TenantApp>>();

  constructor(options: TenantDispatcherOptions) {
    this.baseConfig = options.baseConfig;
    this.controllerId = options.controllerId;
  }

  /** Get-or-create the tenant app for a WorkOS user id. */
  private getTenantApp(workosId: string): Promise<TenantApp> {
    const { tenantKey, storageConfig } = getUserStorage(workosId);
    const existing = this.apps.get(tenantKey);
    if (existing) return existing;

    const built = this.buildTenantApp(storageConfig).catch(err => {
      // Don't cache failures — let the next request retry a clean build.
      this.apps.delete(tenantKey);
      throw err;
    });
    this.apps.set(tenantKey, built);
    return built;
  }

  private async buildTenantApp(storage: MastraCodeConfig['storage']): Promise<TenantApp> {
    const result = await mountAgentControllerOnMastra({
      ...this.baseConfig,
      storage,
      controllerId: this.controllerId,
    });

    const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
    const adapter = new MastraServer({ app, mastra: result.mastra });
    await adapter.init();

    return {
      fetch: (request, ...rest) => app.fetch(request as Request, ...(rest as [])),
      stop: async () => {
        await Promise.allSettled([result.controller.getMastra()?.stopWorkers(), result.controller.stopHeartbeats()]);
      },
    };
  }

  /**
   * Hono middleware: when an authenticated user is present, forward the request
   * to that user's isolated Mastra app and return its response. When no user is
   * present (auth disabled), fall through to the shared adapter via `next()`.
   */
  middleware() {
    return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
      // Custom web-only routes (`/api/web/...`: config, fs, GitHub) live on the
      // outer app and use the app DB + webAuthUser, not tenant Mastra storage.
      // They must NOT be forwarded to the tenant app (which has no such routes).
      if (c.req.path.startsWith('/api/web/')) {
        return next();
      }
      const user = getWebAuthUser(c);
      const workosId = getWebAuthUserId(user);
      if (!workosId) {
        // Auth disabled or unauthenticated public route — use the shared path.
        return next();
      }
      const tenant = await this.getTenantApp(workosId);
      return tenant.fetch(c.req.raw);
    };
  }

  /** Tear down all cached tenant stacks (server shutdown). */
  async stopAll(): Promise<void> {
    const apps = [...this.apps.values()];
    this.apps.clear();
    await Promise.allSettled(
      apps.map(async p => {
        try {
          const app = await p;
          await app.stop();
        } catch {
          // ignore — already failed to build
        }
      }),
    );
  }
}
